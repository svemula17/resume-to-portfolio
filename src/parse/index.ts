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
import type { Line } from "../layout";
import {
  ResumeSchema,
  type ConfidenceMap,
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
 */
function entriesOf(lines: Line[]): Line[][] {
  const entries = splitIntoEntries(lines);
  const dateRanges = lines.filter((line) => DATE_RANGE.test(line.text)).length;
  if (dateRanges <= 1 || entries.length >= dateRanges) return entries;

  const afterBullets = splitWhere(
    lines,
    (line, index) => index > 0 && !isBulletLine(line.text) && isBulletLine(lines[index - 1]!.text),
  );
  if (afterBullets.length >= dateRanges) return afterBullets;

  // Last resort: each date range starts an entry, taking the line above it
  // along if that line is a plain heading rather than a bullet.
  return splitWhere(lines, (line, index) => {
    if (DATE_RANGE.test(line.text)) {
      const above = lines[index - 1];
      return !above || isBulletLine(above.text) || DATE_RANGE.test(above.text);
    }
    const below = lines[index + 1];
    return below !== undefined && DATE_RANGE.test(below.text) && !DATE_RANGE.test(line.text);
  });
}

function summaryOf(sections: Section[]): string | undefined {
  const lines = linesOfKind(sections, "summary");
  if (lines.length === 0) return undefined;
  return lines
    .map((line) => line.text.trim())
    .join(" ")
    .replace(/\s+/g, " ");
}

/** Parse lines that are already in reading order. */
export function parseLines(rawLines: Line[]): ParseResult {
  const lines = mergeWrappedLines(rawLines);
  const sections = splitIntoSections(lines);
  const confidence: ConfidenceMap = {};

  const { basics, confidence: basicsConfidence } = parseBasics(preambleOf(sections));
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

  const skills = parseSkills(linesOfKind(sections, "skills"));
  Object.assign(confidence, skills.confidence);

  const projects = entriesOf(linesOfKind(sections, "projects")).map((entry, index) => {
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

  return { data, confidence };
}

/** Parse raw text — the DOCX path, or pasted text. */
export function parseText(text: string): ParseResult {
  return parseLines(linesFromText(text));
}
