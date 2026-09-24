/**
 * Recover bullets that exist only as indentation.
 *
 * A PDF printed from a browser — Chrome, and therefore Google Docs and every
 * browser-based resume builder — draws list markers but does not write them
 * into the text layer. The "•" is a glyph on the page and absent from what
 * pdf.js extracts. What survives is the indent: the bullet's text starts
 * 12-24pt to the right of the column it belongs to. Without this step every
 * such bullet reads as a heading line, and the first real corpus run had a
 * job whose company was one of its own bullets.
 *
 * The rule: a line is an indented bullet when its left edge sits a bullet's
 * width to the right of an "edge" — an x position enough lines share to be
 * a column's margin — and it is not the continuation of the line above it.
 */
import type { Line } from "../layout";
import { isBulletLine } from "./text";

/** A list indent is at least this; a hanging indent for wrapped text is less. */
const MIN_INDENT = 8;

/** Past this the line is in another column, not indented within this one. */
const MAX_INDENT = 60;

/** x positions shared by fewer lines than this are not column edges. */
const MIN_EDGE_LINES = 3;

/**
 * A line that stopped this far short of the run's right margin ended a
 * bullet; one that ran the full width was wrapped and continues below.
 */
const FULL_WIDTH_RATIO = 0.82;

const ENDS_SENTENCE = /[.!?;:]["')\]]?\s*$/;

/** Distinct left edges, from lines that share an x within rounding. */
function columnEdges(lines: Line[]): number[] {
  const counts = new Map<number, number>();
  for (const line of lines) {
    const key = Math.round(line.x / 2) * 2;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= MIN_EDGE_LINES)
    .map(([x]) => x)
    .sort((a, b) => a - b);
}

/** The nearest edge to the left of x within a bullet's reach, or null. */
function indentBase(x: number, edges: number[]): number | null {
  let base: number | null = null;
  for (const edge of edges) {
    if (x - edge >= MIN_INDENT && x - edge <= MAX_INDENT) base = edge;
  }
  return base;
}

/**
 * Prefix a bullet glyph onto lines that are indented bullets, so that the
 * rest of the parser — the wrap folder, the entry splitter, the bullet
 * extractor — sees exactly what it would have seen from a PDF that wrote
 * its markers. Lines without geometry (the text path) are returned as-is.
 */
interface Previous {
  line: Line;
  bulletBase: number | null;
  fullWidth: boolean;
}

export function markIndentedBullets(lines: Line[]): Line[] {
  if (!lines.some((line) => line.x !== 0)) return lines;
  const edges = columnEdges(lines);
  if (edges.length === 0) return lines;

  const out: Line[] = [];
  let previous: Previous | null = null;

  for (const line of lines) {
    const base = indentBase(line.x, edges);
    let marked = line;

    if (base !== null && !isBulletLine(line.text)) {
      // The run's right margin is unknown in general; the best local proxy
      // is the widest line seen so far in this indent run.
      const continuation =
        previous !== null &&
        previous.bulletBase === base &&
        Math.abs(previous.line.x - line.x) < MIN_INDENT &&
        previous.fullWidth &&
        !ENDS_SENTENCE.test(previous.line.text) &&
        !/^[A-Z][a-z]+ [A-Z]/.test(line.text);
      if (!continuation) marked = { ...line, text: `• ${line.text}` };
    }

    const runRight: number =
      previous !== null && previous.bulletBase === base ? Math.max(previous.line.right, line.right) : line.right;
    out.push(marked);
    previous = {
      line,
      bulletBase: base,
      fullWidth: line.right >= runRight * FULL_WIDTH_RATIO,
    };
  }

  return out;
}
