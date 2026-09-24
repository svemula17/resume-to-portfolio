/**
 * The parser: reading-ordered lines in, a schema-valid resume plus a
 * confidence map out.
 *
 * Nothing here throws on bad input. A resume the parser cannot make sense of
 * produces an empty-but-valid Resume with zero confidences, and the review
 * form takes it from there. Throwing would turn "the parser was weak on this
 * layout" into "the app is broken", and the whole product premise is that the
 * parser is allowed to be weak.
 */
import type { Vocabulary } from "../data/vocabulary";
import type { Line } from "../layout";
import {
  ResumeSchema,
  type ConfidenceMap,
  type LeftoverSection,
  type ParseResult,
  type Resume,
} from "../schema/resume";
import { parseBasics } from "./fields/basics";
import { parseEducationEntry } from "./fields/education";
import { parseExperienceEntry } from "./fields/experience";
import { parseCertificationLine, parseProjectEntry } from "./fields/projects";
import { parseSkills } from "./fields/skills";
import { linesFromText } from "./from-text";
import {
  linesOfKind,
  preambleOf,
  splitIntoSections,
  type Section,
} from "./sections";
import { splitIntoEntries, splitWhere } from "./subsections";
import { DATE_RANGE, isBulletLine } from "./text";
import { markIndentedBullets } from "./indent";
import { mergeRailDates } from "./rail";
import { detrackLines } from "./tracking";
import { mergeWrappedLines } from "./wrap";

export type { Section, SectionKind } from "./sections";
export { splitIntoSections } from "./sections";
export { linesFromText } from "./from-text";

/**
 * Split a section into entries, falling back when whitespace says nothing.
 *
 * Gap-based splitting is the right first answer and usually the only one
 * needed. It is silent on the DOCX path, where leading is uniform, and on
 * the occasional PDF template that puts no extra space between jobs. The
 * check is cheap: if the section holds more date ranges than the splitter
 * found entries, it missed boundaries, and the fallback signal — a heading
 * line that directly follows a bullet — is tried instead.
 *
 * `loose` applies the heading-after-bullet split whenever gap splitting
 * found a single entry and that signal finds more, date ranges or not. Only
 * the review form's re-parse of a pasted block asks for it: a block the user
 * hand-picked is far more likely to be several entries than one, and the
 * result is on screen to be judged. The main parse path never passes it, so
 * every fixture is byte-for-byte unaffected.
 */
export function entriesOf(
  lines: Line[],
  options: { loose?: boolean; titled?: boolean } = {},
): Line[][] {
  const entries = splitIntoEntries(lines);
  const dateLines = lines.map((line) => DATE_RANGE.test(line.text));
  const dateRanges = dateLines.filter(Boolean).length;

  // Projects carry no dates, so when whitespace finds one entry the only
  // remaining signal is shape: a short title line with no full stop, right
  // after a line that ended a sentence, starts a new project.
  if (options.titled && entries.length === 1 && lines.length > 2) {
    const split = splitWhere(lines, (line, index) => {
      const above = lines[index - 1];
      const aboveEnded = above !== undefined && (/[.!?]["')]?\s*$/.test(above.text) || LABEL_LINE.test(above.text));
      return (
        aboveEnded &&
        line.text.length <= 60 &&
        !/[.!?]\s*$/.test(line.text) &&
        !isBulletLine(line.text) &&
        // "Technologies: Python" is the tail of a project, not the next one.
        !LABEL_LINE.test(line.text)
      );
    });
    if (split.length > 1) return split;
  }

  if (options.loose && entries.length === 1) {
    const split = splitWhere(
      lines,
      (line, index) => index > 0 && !isBulletLine(line.text) && isBulletLine(lines[index - 1]!.text),
    );
    if (split.length > 1) return split;
  }

  if (dateRanges <= 1 || entries.length >= dateRanges) return entries;
  return splitByDates(lines, dateLines);
}

/**
 * One date range per entry: the rule that holds for experience and
 * education on essentially every resume, used when whitespace found fewer
 * entries than there are date ranges.
 *
 * Templates put the date on the first line of an entry ("Role | dates"),
 * the second ("Company / Role | dates") or the third ("Company / Role /
 * dates"), and the boundary between two entries depends on which. The
 * first entry tells: the number of non-bullet lines above its date line is
 * the number of heading lines every entry carries above its own. After a
 * date line, its bullets run until the first non-bullet line, which starts
 * the next entry; with no bullets between two date lines, the next entry
 * starts that many heading lines above the second date.
 */
function splitByDates(lines: Line[], dateLines: boolean[]): Line[][] {
  const firstDate = dateLines.indexOf(true);
  let headingLinesAbove = 0;
  for (let i = firstDate - 1; i >= 0 && !isBulletLine(lines[i]!.text); i -= 1) headingLinesAbove += 1;

  const starts = new Set<number>([0]);
  let previousDate = firstDate;
  for (let i = firstDate + 1; i < lines.length; i += 1) {
    if (!dateLines[i]) continue;
    let boundary = -1;
    for (let j = previousDate + 1; j < i; j += 1) {
      if (isBulletLine(lines[j]!.text)) continue;
      // First non-bullet after the previous date's bullets, if any bullets came.
      if (j > previousDate + 1 && isBulletLine(lines[j - 1]!.text)) {
        boundary = j;
        break;
      }
    }
    if (boundary < 0) boundary = Math.max(previousDate + 1, i - headingLinesAbove);
    starts.add(boundary);
    previousDate = i;
  }

  const entries: Line[][] = [];
  let current: Line[] = [];
  lines.forEach((line, index) => {
    if (index > 0 && starts.has(index) && current.length > 0) {
      entries.push(current);
      current = [];
    }
    current.push(line);
  });
  if (current.length > 0) entries.push(current);
  return entries;
}

function summaryOf(sections: Section[]): string | undefined {
  const lines = linesOfKind(sections, "summary");
  if (lines.length === 0) return undefined;
  return lines
    .map((line) => line.text.trim())
    .join(" ")
    .replace(/\s+/g, " ");
}

/** "Technologies: …", "Tech: …" — a labelled tail line inside an entry. */
const LABEL_LINE = /^[A-Za-z][A-Za-z ]{1,24}:/;

/** Section kinds a field parser consumes. Everything else is leftover. */
const PARSED_KINDS = new Set<string>([
  "contact",
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
]);

export interface ParseOptions {
  /**
   * The skills vocabulary, when it has been loaded. Optional so the parser
   * stays synchronous and usable without it; the only effect is that a flat
   * skills list made of known terms is not flagged for review.
   */
  vocabulary?: Vocabulary;
}

/** Parse lines that are already in reading order. */
export function parseLines(rawLines: Line[], options: ParseOptions = {}): ParseResult {
  const lines = mergeWrappedLines(markIndentedBullets(mergeRailDates(detrackLines(rawLines))));
  const sections = splitIntoSections(lines);
  const confidence: ConfidenceMap = {};

  const preamble = preambleOf(sections);
  const { basics, confidence: basicsConfidence } = parseBasics(preamble, [
    ...preamble,
    ...linesOfKind(sections, "contact"),
  ]);
  Object.assign(confidence, basicsConfidence);

  const summary = summaryOf(sections);
  if (summary) {
    basics.summary = summary;
    confidence["basics.summary"] = 0.85;
  }

  const experience = entriesOf(linesOfKind(sections, "experience")).map((entry, index) => {
    const parsed = parseExperienceEntry(entry, index);
    Object.assign(confidence, parsed.confidence);
    return parsed.value;
  });

  const education = entriesOf(linesOfKind(sections, "education")).map((entry, index) => {
    const parsed = parseEducationEntry(entry, index);
    Object.assign(confidence, parsed.confidence);
    return parsed.value;
  });

  const skills = parseSkills(linesOfKind(sections, "skills"), options.vocabulary);
  Object.assign(confidence, skills.confidence);

  const projects = entriesOf(linesOfKind(sections, "projects"), { titled: true }).map((entry, index) => {
    const parsed = parseProjectEntry(entry, index);
    Object.assign(confidence, parsed.confidence);
    return parsed.value;
  });

  let certificationCount = 0;
  const certifications = linesOfKind(sections, "certifications")
    .filter((line) => line.text.trim() !== "")
    .flatMap((line) => {
      const parsed = parseCertificationLine(line.text, certificationCount);
      certificationCount += parsed.length;
      for (const entry of parsed) Object.assign(confidence, entry.confidence);
      return parsed.map((entry) => entry.value);
    });

  const candidate = {
    basics,
    experience,
    education,
    projects,
    skills: skills.value,
    certifications,
  };

  // safeParse, not parse. The only way this can fail is an empty name, and
  // an empty name is a parse result to show the user, not an exception.
  const validated = ResumeSchema.safeParse(candidate);
  const data: Resume = validated.success
    ? validated.data
    : ResumeSchema.parse({ ...candidate, basics: { ...basics, name: basics.name || "Unknown" } });

  if (!basics.name) confidence["basics.name"] = 0;

  // Every headed section no field parser claimed. Sections with a known kind
  // but no parser yet (awards, publications, volunteer, languages, interests,
  // references) count too — to the user they are equally "text the form did
  // not pick up".
  //
  // Entries are kept apart by a single "" line. Without it the paragraph
  // structure is lost — a three-project block flattens to three lines with
  // uniform leading, and re-parsing it later can only ever find one entry.
  const leftover: LeftoverSection[] = sections
    .filter((section) => section.heading !== null && !PARSED_KINDS.has(section.kind))
    .filter((section) => section.lines.some((line) => line.text.trim() !== ""))
    .map((section) => ({
      heading: section.heading ?? "",
      lines: entriesOf(section.lines)
        .map((entry) => entry.map((line) => line.text.trim()).filter(Boolean))
        .filter((entry) => entry.length > 0)
        .flatMap((entry, index) => (index === 0 ? entry : ["", ...entry])),
    }));

  return { data, confidence, leftover };
}

/** Parse raw text — the DOCX path, or pasted text. */
export function parseText(text: string, options: ParseOptions = {}): ParseResult {
  return parseLines(linesFromText(text), options);
}
