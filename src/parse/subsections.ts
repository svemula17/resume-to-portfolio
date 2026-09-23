/**
 * Split a section's lines into entries — one job, one degree, one project.
 *
 * The signal is vertical whitespace. Designers separate entries with more
 * space than they put between lines of the same entry, and that is true across
 * essentially every resume template regardless of how it looks otherwise.
 */
import type { Line } from "../layout";
import { isBulletLine } from "./text";

/**
 * A gap this much larger than the typical one starts a new entry.
 *
 * The typical gap is the median, not the mean: a section with one unusually
 * tall spacer would drag a mean up far enough to hide every real boundary,
 * and medians are immune to exactly that.
 *
 * 1.4 comes from how templates are built — entry spacing is usually set as a
 * paragraph space-before of a half to a full line on top of normal leading,
 * so the ratio lands near 1.5. Sitting just under it catches the tighter
 * templates without splitting on ordinary leading jitter.
 */
const ENTRY_GAP_RATIO = 1.4;

/**
 * The most leading a paragraph ever has, as a multiple of glyph height.
 * When every gap in a section exceeds it, the median is a paragraph
 * break, not a line step, and comparing gaps to the median would find no
 * boundaries in a section that is nothing but boundaries — one-line
 * entries separated by blank lines, the shape of a pasted project list.
 * Capping the "typical" gap at this keeps such a section splittable.
 */
const MAX_LEADING_RATIO = 1.6;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

/**
 * Split on vertical gaps larger than the section's typical gap.
 *
 * A bullet line never starts an entry, whatever the spacing says. Bullets
 * belong to the entry above them by definition, and some templates put real
 * space between them — without this guard a job with airy bullets shatters
 * into one "entry" per bullet.
 */
export function splitIntoEntries(lines: Line[]): Line[][] {
  if (lines.length === 0) return [];
  if (lines.length === 1) return [lines];

  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    gaps.push(lines[i]!.y - lines[i - 1]!.y);
  }

  const medianGap = median(gaps);
  if (medianGap <= 0) return [lines];

  // A section with no variation at all — common on the DOCX path, where
  // leading is synthetic and uniform — has no boundaries to find, unless
  // that uniform gap is itself too big to be leading.
  const lineHeight = median(lines.map((line) => line.height));
  const typical = Math.min(medianGap, lineHeight * MAX_LEADING_RATIO);
  const threshold = typical * ENTRY_GAP_RATIO;
  const entries: Line[][] = [];
  let current: Line[] = [lines[0]!];

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i]!;
    const gap = gaps[i - 1]!;

    if (gap > threshold && !isBulletLine(line.text)) {
      entries.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }

  entries.push(current);
  return entries;
}

/**
 * Fallback entry splitter for sections where whitespace says nothing.
 *
 * On the DOCX path leading is uniform by construction, so splitIntoEntries
 * returns the whole section as one entry. `startsEntry` lets a caller supply
 * the only other available signal — "this line looks like the start of a job"
 * — and re-split on that.
 */
export function splitWhere(
  lines: Line[],
  startsEntry: (line: Line, index: number) => boolean,
): Line[][] {
  const entries: Line[][] = [];
  let current: Line[] = [];

  lines.forEach((line, index) => {
    if (current.length > 0 && startsEntry(line, index) && !isBulletLine(line.text)) {
      entries.push(current);
      current = [];
    }
    current.push(line);
  });

  if (current.length > 0) entries.push(current);
  return entries;
}
