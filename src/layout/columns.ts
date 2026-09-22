/**
 * Detect whether a page is one column or two, and if two, where the gutter is.
 *
 * This is the only genuinely unsolved problem in the pipeline. A PDF stores
 * text in content-stream order, which for a two-column resume is frequently
 * not reading order, and there is no packaged browser library that fixes it.
 *
 * The governing bias, everywhere in this file: when in doubt, say "single".
 * A two-column page read as one column produces interleaved but locally
 * coherent text that a human can still repair in the review form. A
 * single-column page wrongly split scrambles every entry on the page into
 * fragments that belong to nothing. The failure modes are not symmetric, so
 * neither are the thresholds.
 */
import type { Page, TextItem } from "../extract/types";
import { groupIntoLines } from "./lines";
import type { ColumnLayout } from "./types";

/**
 * A gutter narrower than this is word spacing or a tab stop, not a column
 * boundary. Expressed as a fraction of page width so it holds for A4 and
 * Letter alike: ~18pt on a 612pt page, comfortably wider than the ~3-6pt
 * between words and narrower than any real inter-column margin.
 */
const MIN_GUTTER_RATIO = 0.03;

/**
 * The gutter has to sit in the middle 60% of the page. A "gap" near either
 * edge is a margin or an indent, and splitting on one produces a column that
 * is really just a hanging indent.
 */
const GUTTER_ZONE_START = 0.2;
const GUTTER_ZONE_END = 0.8;

/**
 * Both sides must carry real content. A side holding a handful of items is a
 * right-aligned date column or a page number, not a column of the document.
 */
const MIN_SIDE_ITEM_SHARE = 0.15;
const MIN_SIDE_LINES = 3;

/**
 * The single most important check in this file.
 *
 * A layout like "Company Name .......... Jan 2020 - Present" leaves a wide
 * vertical band of whitespace down the middle of the page, and a histogram
 * cannot tell it apart from a real gutter. The difference is not in the
 * whitespace, it is in the lines: in a tabbed layout, nearly every line has
 * content on BOTH sides of the gap. In a genuine two-column layout, the two
 * columns have independent leading, so lines that happen to span both sides
 * are coincidental baseline collisions rather than the rule.
 *
 * 0.3 leaves room for those collisions — a sidebar and a main column can
 * easily share a baseline a few times per page — while still rejecting the
 * tabbed case, where the ratio approaches 1.
 */
const MAX_STRADDLE_RATIO = 0.3;

/**
 * The straddle check's own escape hatch, and the reason it is safe to be
 * aggressive above.
 *
 * Some two-column resumes do align their rows across the gutter — a sidebar
 * and a main column laid out on a shared grid — and those would be rejected by
 * the straddle ratio alone. What still separates them from a tabbed layout is
 * the width of the gap: a typographic gutter is deliberately tight, 15-40pt on
 * a Letter page, because the designer wants the columns to read as one spread.
 * The whitespace in a tabbed layout is not designed at all — it is the slack
 * between ragged left-hand text and a tab stop near the right margin, and it
 * routinely runs to 150-250pt.
 *
 * So a high straddle ratio is forgiven when the gap is tight enough to be a
 * real gutter (~49pt on a 612pt page) and both sides carry enough lines to be
 * columns. A wide band plus lines spanning it stays single, every time.
 */
const TIGHT_GUTTER_RATIO = 0.08;
const TIGHT_GUTTER_MIN_LINES = 6;

/**
 * Full-width header blocks fill the buckets a gutter would occupy, hiding it.
 * Rather than guess at which items are "header-ish", the search is retried
 * with progressively more of the top of the page held out. The first band that
 * reveals a valid gutter wins; if none does, the page is single-column.
 *
 * 35% is the ceiling because a header taller than a third of the page is not a
 * header, and excluding more than that would start hiding real content.
 */
const HEADER_BAND_RATIOS = [0, 0.12, 0.2, 0.28, 0.35];

/** A contiguous run of page-width buckets that no text covers. */
export interface Gap {
  start: number;
  end: number;
  width: number;
  centre: number;
}

/**
 * Coverage histogram at 1-point resolution: bucket i counts the items whose
 * horizontal extent covers x = i.
 */
export function buildCoverageHistogram(
  items: TextItem[],
  pageWidth: number,
): Uint32Array {
  const buckets = new Uint32Array(Math.max(1, Math.ceil(pageWidth)));

  for (const item of items) {
    const from = Math.max(0, Math.floor(item.x));
    // An item of zero measured width still occupies the bucket it starts in;
    // without the max() it would contribute nothing and punch a false gap.
    const to = Math.min(buckets.length - 1, Math.ceil(item.x + Math.max(item.width, 1)));
    for (let bucket = from; bucket <= to; bucket += 1) {
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }
  }

  return buckets;
}

/** Every run of consecutive empty buckets, in order. */
export function findEmptyRuns(buckets: Uint32Array): Gap[] {
  const gaps: Gap[] = [];
  let runStart: number | null = null;

  for (let i = 0; i < buckets.length; i += 1) {
    if (buckets[i] === 0) {
      if (runStart === null) runStart = i;
    } else if (runStart !== null) {
      gaps.push({ start: runStart, end: i, width: i - runStart, centre: (runStart + i) / 2 });
      runStart = null;
    }
  }

  // A run reaching the right edge is the right margin, never a gutter, so it
  // is deliberately not emitted here.
  return gaps;
}

/**
 * The widest empty run that could plausibly be a gutter: wide enough, and
 * centred within the middle band of the page.
 */
export function findGutterCandidate(
  items: TextItem[],
  pageWidth: number,
): Gap | null {
  const buckets = buildCoverageHistogram(items, pageWidth);
  const minWidth = pageWidth * MIN_GUTTER_RATIO;
  const zoneStart = pageWidth * GUTTER_ZONE_START;
  const zoneEnd = pageWidth * GUTTER_ZONE_END;

  let best: Gap | null = null;
  for (const gap of findEmptyRuns(buckets)) {
    if (gap.width < minWidth) continue;
    if (gap.centre < zoneStart || gap.centre > zoneEnd) continue;
    if (best === null || gap.width > best.width) best = gap;
  }

  return best;
}

function partition(items: TextItem[], gap: Gap) {
  const leftItems: TextItem[] = [];
  const rightItems: TextItem[] = [];
  const fullWidthItems: TextItem[] = [];

  for (const item of items) {
    const right = item.x + item.width;
    if (right <= gap.start) leftItems.push(item);
    else if (item.x >= gap.end) rightItems.push(item);
    // Straddles the gutter: a header block, or a rule of text drawn across
    // the page. It belongs to neither column and is emitted before both.
    else fullWidthItems.push(item);
  }

  return { leftItems, rightItems, fullWidthItems };
}

/**
 * Fraction of lines below `bandBottom` that have content on both sides of the
 * gap. See MAX_STRADDLE_RATIO for why this is the check that matters.
 */
function straddleRatio(page: Page, gap: Gap, bandBottom: number): number {
  const below = page.items.filter((item) => item.y > bandBottom);
  const lines = groupIntoLines(page, below);
  if (lines.length === 0) return 1;

  let straddling = 0;
  for (const line of lines) {
    const hasLeft = line.items.some((item) => item.x + item.width <= gap.start);
    const hasRight = line.items.some((item) => item.x >= gap.end);
    if (hasLeft && hasRight) straddling += 1;
  }

  return straddling / lines.length;
}

/**
 * Classify a page's layout.
 *
 * Returns `single` unless every check passes: a wide enough gap in the middle
 * band, real content on both sides, enough lines on both sides, and lines that
 * mostly belong to one side rather than spanning both.
 */
export function detectColumns(page: Page): ColumnLayout {
  const single: ColumnLayout = { type: "single", items: page.items };
  if (page.items.length === 0) return single;

  for (const bandRatio of HEADER_BAND_RATIOS) {
    const bandBottom = page.height * bandRatio;
    const candidateItems = page.items.filter((item) => item.y > bandBottom);
    if (candidateItems.length === 0) continue;

    const gap = findGutterCandidate(candidateItems, page.width);
    if (!gap) continue;

    const { leftItems, rightItems, fullWidthItems } = partition(page.items, gap);

    const sided = leftItems.length + rightItems.length;
    if (sided === 0) continue;
    if (leftItems.length / sided < MIN_SIDE_ITEM_SHARE) continue;
    if (rightItems.length / sided < MIN_SIDE_ITEM_SHARE) continue;

    const leftLines = groupIntoLines(page, leftItems).length;
    const rightLines = groupIntoLines(page, rightItems).length;
    if (leftLines < MIN_SIDE_LINES || rightLines < MIN_SIDE_LINES) continue;

    if (straddleRatio(page, gap, bandBottom) > MAX_STRADDLE_RATIO) {
      const tightGutter = gap.width <= page.width * TIGHT_GUTTER_RATIO;
      const substantial =
        leftLines >= TIGHT_GUTTER_MIN_LINES && rightLines >= TIGHT_GUTTER_MIN_LINES;
      if (!tightGutter || !substantial) continue;
    }

    return {
      type: "two-column",
      gutterX: gap.centre,
      gutterStart: gap.start,
      gutterEnd: gap.end,
      leftItems,
      rightItems,
      fullWidthItems,
    };
  }

  return single;
}
