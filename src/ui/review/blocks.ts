/**
 * Re-parse a block of text into entries for one section.
 *
 * The Source panel's "Add to ▾", the full-text select-to-add, and each
 * section's "Add from text" all run through here. It is the same field
 * parsers the first parse used — nothing is re-implemented — applied to a
 * block the user chose, which is why `loose` splitting is safe: the result
 * lands on screen, expanded, one undo away.
 */
import { parseEducationEntry } from "../../parse/fields/education";
import { parseExperienceEntry } from "../../parse/fields/experience";
import { parseCertificationLine, parseProjectEntry } from "../../parse/fields/projects";
import { parseSkills } from "../../parse/fields/skills";
import { linesFromText } from "../../parse/from-text";
import { entriesOf } from "../../parse/index";
import { mergeWrappedLines } from "../../parse/wrap";
import type { ListPath } from "./keys";
import type { ItemOf } from "./lists";

/** Every section a block can be parsed into. Links are never imported. */
export type ImportTarget = Exclude<ListPath, "basics.links">;

export interface ImportedEntry<P extends ListPath> {
  value: ItemOf<P>;
  /** Keys are relative — `${path}.${i}.${field}` — and re-keyed on import. */
  confidence: Record<string, number>;
}

/**
 * The heading rule, for projects only. With exactly one entry, the block's
 * heading is that entry's first line: "VIGIL" was a project name the parser
 * mistook for a heading, and prepending it gives the project its name back.
 * With two or more entries the heading is a section title — "AI SECURITY —
 * BUILT & PUBLISHED" — and belongs to none of them.
 *
 * Never for experience or education. A caps heading over a job is "TOOLS"
 * or "WORK", never the company, and on the first real run it outscored the
 * actual company name beside it. Wrong guesses are visible immediately and
 * one undo away, but a rule that is wrong on every job is not a guess.
 */
function withHeading(
  target: ImportTarget,
  text: string,
  heading: string | undefined,
  entryCount: number,
): string {
  if (target !== "projects" || !heading || entryCount !== 1) return text;
  return `${heading}\n${text}`;
}

export function parseBlockAs<T extends ImportTarget>(
  target: T,
  text: string,
  heading?: string,
): ImportedEntry<T>[] {
  const initial = mergeWrappedLines(linesFromText(text));
  if (initial.length === 0) return [];

  if (target === "skills") {
    const parsed = parseSkills(initial);
    return parsed.value.map((group, index) => {
      // A block headed "LANGUAGES" holding one flat list is one labelled
      // group; the heading is the label the parser could not see.
      const value =
        parsed.value.length === 1 && !group.category && heading
          ? { ...group, category: titleCase(heading) }
          : group;
      return {
        value: value as ItemOf<T>,
        confidence: pick(parsed.confidence, `skills.${index}.`),
      };
    });
  }

  if (target === "certifications") {
    const out: ImportedEntry<T>[] = [];
    let count = 0;
    for (const line of initial) {
      if (line.text.trim() === "") continue;
      for (const entry of parseCertificationLine(line.text, count)) {
        out.push({ value: entry.value as ItemOf<T>, confidence: entry.confidence });
        count += 1;
      }
    }
    return out;
  }

  // Entry-shaped sections. Decide the entry count first, then apply the
  // heading rule and re-split, because the heading may itself become a line.
  const probe = entriesOf(initial, { loose: true });
  const lines = mergeWrappedLines(linesFromText(withHeading(target, text, heading, probe.length)));
  const entries = entriesOf(lines, { loose: true });

  return entries.map((entry, index) => {
    switch (target) {
      case "experience": {
        const parsed = parseExperienceEntry(entry, index);
        return { value: parsed.value as ItemOf<T>, confidence: parsed.confidence };
      }
      case "education": {
        const parsed = parseEducationEntry(entry, index);
        return { value: parsed.value as ItemOf<T>, confidence: parsed.confidence };
      }
      default: {
        const parsed = parseProjectEntry(entry, index);
        return { value: parsed.value as ItemOf<T>, confidence: parsed.confidence };
      }
    }
  });
}

/** "LANGUAGES" → "Languages"; anything not all-caps is left alone. */
function titleCase(text: string): string {
  if (text !== text.toUpperCase()) return text;
  return text.toLowerCase().replace(/(^|\s|[-&/])([a-z])/g, (_, before: string, letter: string) => before + letter.toUpperCase());
}

function pick(confidence: Record<string, number>, prefix: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(confidence)) {
    if (key.startsWith(prefix)) out[key] = value;
  }
  return out;
}
