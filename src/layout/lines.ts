/**
 * Group positioned text items into visual lines.
 *
 * Two problems are solved here, in order:
 *
 * 1. pdf.js splits a single visual run into several items whenever the content
 *    stream changes font, kerning or text-positioning operator. A phone number
 *    routinely arrives as three separate items. Anything downstream that
 *    pattern-matches on text will fail on those fragments, so adjacent items
 *    are merged back together first.
 *
 * 2. Items that share a baseline belong to one line, but the baselines are
 *    floating-point values that rarely match exactly.
 */
import type { Page, TextItem } from "../extract/types";
import type { Line } from "./types";

/**
 * Baselines on one visual line differ by rounding and by the odd superscript.
 * A fraction of the line height absorbs that without merging genuinely
 * separate lines: resume body text is typically 10-12pt on 13-16pt leading, so
 * a third of the item height stays well inside the gap to the next line.
 */
const BASELINE_TOLERANCE_RATIO = 0.35;

/** Floor for the tolerance, so a page of tiny text still groups sensibly. */
const MIN_BASELINE_TOLERANCE = 1.5;

/**
 * Average glyph width across a page, used as the threshold for merging two
 * horizontally adjacent items.
 *
 * Bold items are excluded because they are wider per character, and on a
 * resume they are concentrated in headers and names — including them biases
 * the average upward and starts merging across real word gaps in body text.
 */
export function averageCharWidth(items: TextItem[]): number {
  let totalWidth = 0;
  let totalChars = 0;

  for (const item of items) {
    if (item.bold) continue;
    const length = item.str.length;
    if (length === 0) continue;
    totalWidth += item.width;
    totalChars += length;
  }

  // An all-bold page (rare, but a one-line header-only page hits it) would
  // divide by zero. Fall back to measuring everything.
  if (totalChars === 0) {
    for (const item of items) {
      const length = item.str.length;
      if (length === 0) continue;
      totalWidth += item.width;
      totalChars += length;
    }
  }

  return totalChars === 0 ? 0 : totalWidth / totalChars;
}

/**
 * Merge items whose horizontal gap is smaller than one average character.
 *
 * A gap that small was never a word break — it is pdf.js having split a run
 * mid-word. Where the gap is around a full character wide the original text
 * had a space, so one is inserted.
 */
function mergeAdjacent(items: TextItem[], charWidth: number): TextItem[] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => a.x - b.x);
  const merged: TextItem[] = [];
  let current: TextItem = { ...sorted[0]! };

  for (let i = 1; i < sorted.length; i += 1) {
    const next = sorted[i]!;
    const gap = next.x - (current.x + current.width);

    if (gap < charWidth) {
      // A hair of space is a split run; anything approaching a full character
      // was a real space that the content stream encoded as positioning.
      const separator = gap > charWidth * 0.4 ? " " : "";
      current = {
        ...current,
        str: current.str + separator + next.str,
        width: next.x + next.width - current.x,
        height: Math.max(current.height, next.height),
        // A merged run counts as bold only if all of its parts were. A bold
        // label followed by plain text is not a bold line.
        bold: current.bold && next.bold,
      };
    } else {
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);
  return merged;
}

/** Build a Line from items already known to share a baseline. */
function toLine(items: TextItem[], charWidth: number): Line {
  const merged = mergeAdjacent(items, charWidth);
  const height = Math.max(...merged.map((item) => item.height));
  const last = merged[merged.length - 1]!;

  return {
    items: merged,
    y: merged.reduce((sum, item) => sum + item.y, 0) / merged.length,
    height,
    isBold: merged.every((item) => item.bold),
    x: merged[0]!.x,
    right: last.x + last.width,
    // Items separated by more than a character already represent distinct
    // words or columns of a tabbed row, so they are joined with a space.
    text: merged.map((item) => item.str).join(" ").replace(/\s+/g, " ").trim(),
  };
}

/**
 * Group a page's items into lines, top to bottom.
 *
 * Pass `items` to group a subset — a single detected column — rather than the
 * whole page. The average character width is always measured across the full
 * page, so a narrow sidebar does not get its own, skewed threshold.
 */
export function groupIntoLines(page: Page, items: TextItem[] = page.items): Line[] {
  if (items.length === 0) return [];

  const charWidth = averageCharWidth(page.items);
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);

  const lines: Line[] = [];
  let bucket: TextItem[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i += 1) {
    const item = sorted[i]!;
    const reference = bucket[0]!;
    const tolerance = Math.max(
      MIN_BASELINE_TOLERANCE,
      reference.height * BASELINE_TOLERANCE_RATIO,
    );

    if (Math.abs(item.y - reference.y) <= tolerance) {
      bucket.push(item);
    } else {
      lines.push(toLine(bucket, charWidth));
      bucket = [item];
    }
  }

  lines.push(toLine(bucket, charWidth));
  return lines;
}
