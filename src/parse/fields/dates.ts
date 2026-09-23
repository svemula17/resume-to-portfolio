/**
 * Pull a date range out of an entry, wherever in it the designer put one.
 *
 * Templates place dates on the role line, the company line, a line of their
 * own, or right-aligned on the same line as the company. Rather than encode
 * each layout, the whole entry is searched and the first range wins — a
 * resume entry has exactly one date range in practice, so the first match is
 * the right one.
 */
import type { Line } from "../../layout";
import { DATE_RANGE, PRESENT_WORD } from "../text";

export interface DateRange {
  startDate: string;
  endDate?: string;
  current: boolean;
  /** Index of the line the range was found on, so callers can exclude it. */
  lineIndex: number;
  /** The matched text, so callers can strip it before parsing the rest. */
  matchedText: string;
}

export function findDateRange(lines: Line[]): DateRange | null {
  for (let index = 0; index < lines.length; index += 1) {
    const match = DATE_RANGE.exec(lines[index]!.text);
    if (!match) continue;

    const start = match[1]!;
    const end = match[2]!;
    const current = PRESENT_WORD.test(end);

    return {
      startDate: start,
      // "Present" is not a date. Recording it as one would mean every template
      // has to special-case the string; the boolean carries the meaning and
      // endDate stays genuinely absent.
      endDate: current ? undefined : end,
      current,
      lineIndex: index,
      matchedText: match[0],
    };
  }

  return null;
}

/** Remove a matched range and any orphaned separator left behind. */
export function stripDateRange(text: string, matched: string): string {
  return text
    .replace(matched, "")
    .replace(/\s*[|•·,–—-]\s*$/, "")
    .replace(/^\s*[|•·,–—-]\s*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
