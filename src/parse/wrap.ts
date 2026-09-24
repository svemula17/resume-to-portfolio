/**
 * Fold wrapped lines back into the line they continue.
 *
 * A bullet that runs to three visual lines arrives as three Lines: one that
 * starts with the glyph and two that do not. Left alone, every downstream
 * parser sees two orphan fragments per long bullet — fragments that start
 * mid-sentence, contain no glyph, and look for all the world like a new
 * heading. Folding them first is what lets the entry splitter and the bullet
 * extractor stay simple.
 */
import type { Line } from "../layout";
import { DATE_RANGE, isBulletLine } from "./text";

/**
 * Left-edge difference that counts as a real indent or outdent. Under this,
 * two lines share an edge — and 3pt is well inside the jitter pdf.js
 * introduces between a glyph item and a text item on the same line.
 */
const EDGE_TOLERANCE = 3;

/**
 * A hanging indent is a few tens of points. Past this the line is in
 * another column: the last bullet of a main column once swallowed the
 * sidebar's first heading, 370pt to its right, as its own wrapped tail.
 */
const MAX_HANGING_INDENT = 48;

const ENDS_SENTENCE = /[.!?;:]["')\]]?\s*$/;

/** A title between bullet groups is a few words; a wrapped tail can be long. */
const TITLE_MAX_CHARS = 48;

/**
 * A wrapped line sits one line of leading below its bullet. Leading runs
 * 1.2-1.5× the glyph height in body text, so a gap past 1.6× is a blank
 * line or an entry break — and text on the far side of that is never a
 * continuation, whatever its punctuation says. On the text path a blank
 * line is exactly a double step, so this catches it there too.
 */
const MAX_CONTINUATION_GAP_RATIO = 1.6;

/**
 * Whether `line` continues `previous`.
 *
 * Geometry answers only when it actually says something. A line outdented
 * past the bullet's left edge is a heading, whatever its punctuation; a line
 * indented past it is a hanging-indent continuation, whatever its
 * punctuation. A line at the same edge is the case geometry is silent on —
 * plenty of templates wrap bullets flush with the glyph rather than with the
 * text — and there the textual rule decides: a continuation is a line that
 * starts in lowercase, or one whose predecessor did not finish its sentence.
 *
 * A line carrying a date range is never a continuation. It is the one
 * heading signal reliable enough to override everything else, and it is the
 * case where a wrong merge does the most damage — swallowing a whole job
 * heading into the previous job's last bullet.
 */
function continues(
  previous: Line,
  before: Line,
  line: Line,
  next: Line | undefined,
  hasGeometry: boolean,
): boolean {
  if (isBulletLine(line.text)) return false;
  if (DATE_RANGE.test(line.text)) return false;
  const gap = line.y - before.y;
  // A continuation is below the line it continues. A line above it — the
  // top of the next column — is the start of something else.
  if (gap < 0) return false;
  if (gap > Math.max(line.height, before.height) * MAX_CONTINUATION_GAP_RATIO) return false;

  if (hasGeometry) {
    const indent = line.x - previous.x;
    if (indent < -EDGE_TOLERANCE) return false;
    if (indent > MAX_HANGING_INDENT) return false;
    if (indent > EDGE_TOLERANCE) return true;
  }

  if (/^[a-z]/.test(line.text)) return true;

  // A short capitalised line sitting between two bullets is a title, not a
  // wrapped tail: "Vigil / - guards tool calls / Sentinel / - scans prompts"
  // is two projects, and without this the unpunctuated first bullet would
  // swallow "Sentinel". Wrapped tails start mid-sentence, in lowercase, far
  // more often than they start with a capital and stop short of a period.
  if (next && isBulletLine(next.text) && line.text.length <= TITLE_MAX_CHARS && !ENDS_SENTENCE.test(line.text)) {
    return false;
  }

  return !ENDS_SENTENCE.test(previous.text);
}

export function mergeWrappedLines(lines: Line[]): Line[] {
  if (lines.length < 2) return lines;

  // Synthetic lines from the DOCX adapter all sit at x = 0; real ones never
  // all do. That is the cheapest reliable way to tell the two paths apart.
  const hasGeometry = lines.some((line) => line.x !== 0);

  const merged: Line[] = [];
  let openBullet: Line | null = null;

  lines.forEach((line, index) => {
    if (
      openBullet !== null &&
      continues(openBullet, lines[index - 1]!, line, lines[index + 1], hasGeometry)
    ) {
      const folded: Line = {
        ...openBullet,
        items: [...openBullet.items, ...line.items],
        text: `${openBullet.text} ${line.text}`.replace(/\s+/g, " "),
        right: Math.max(openBullet.right, line.right),
        // The merged line keeps the bullet's own x so the next continuation
        // is measured against the glyph, not against the wrapped text.
      };
      openBullet = folded;
      merged[merged.length - 1] = folded;
      return;
    }

    merged.push(line);
    openBullet = isBulletLine(line.text) ? line : null;
  });

  return merged;
}
