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

const ENDS_SENTENCE = /[.!?;:]["')\]]?\s*$/;

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
function continues(previous: Line, line: Line, hasGeometry: boolean): boolean {
  if (isBulletLine(line.text)) return false;
  if (DATE_RANGE.test(line.text)) return false;

  if (hasGeometry) {
    const indent = line.x - previous.x;
    if (indent < -EDGE_TOLERANCE) return false;
    if (indent > EDGE_TOLERANCE) return true;
  }

  if (/^[a-z]/.test(line.text)) return true;
  return !ENDS_SENTENCE.test(previous.text);
}

export function mergeWrappedLines(lines: Line[]): Line[] {
  if (lines.length < 2) return lines;

  // Synthetic lines from the DOCX adapter all sit at x = 0; real ones never
  // all do. That is the cheapest reliable way to tell the two paths apart.
  const hasGeometry = lines.some((line) => line.x !== 0);

  const merged: Line[] = [];
  let openBullet: Line | null = null;

  for (const line of lines) {
    if (openBullet !== null && continues(openBullet, line, hasGeometry)) {
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
      continue;
    }

    merged.push(line);
    openBullet = isBulletLine(line.text) ? line : null;
  }

  return merged;
}
