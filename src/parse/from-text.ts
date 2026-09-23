/**
 * Adapter: plain text -> Line[], so the DOCX path feeds the same rule engine.
 *
 * A DOCX arrives with no geometry at all. Rather than give the parser a second
 * input shape to handle, synthetic coordinates are invented here: fixed
 * leading, x always 0, bold always false.
 *
 * The one piece of real information a raw-text document carries is the blank
 * line. In a PDF, subsection splitting keys off a vertical gap larger than the
 * typical one; a blank line is exactly that signal, so it is translated into a
 * double-height gap and the same splitter works unchanged on both paths.
 */
import type { Line } from "../layout";
import type { TextItem } from "../extract/types";

/** Synthetic leading, in the same PDF points every other module speaks. */
const LINE_STEP = 14;

/** Roughly 11pt text, so averageCharWidth-style maths stays sane. */
const LINE_HEIGHT = 11;
const CHAR_WIDTH = 5.5;

export function linesFromText(text: string): Line[] {
  const lines: Line[] = [];
  let y = LINE_STEP;

  for (const raw of text.split(/\r?\n/)) {
    const trimmed = raw.trim();

    if (trimmed === "") {
      // A blank line is a paragraph break. Advancing y without emitting a line
      // is what turns it into the oversized gap the subsection splitter looks
      // for.
      y += LINE_STEP;
      continue;
    }

    const item: TextItem = {
      str: trimmed,
      x: 0,
      y,
      width: trimmed.length * CHAR_WIDTH,
      height: LINE_HEIGHT,
      fontName: "synthetic",
      bold: false,
    };

    lines.push({
      items: [item],
      y,
      height: LINE_HEIGHT,
      // Always false, and deliberately so: claiming a DOCX line is bold when
      // nothing was measured would feed the heading heuristic a fact that is
      // not in evidence.
      isBold: false,
      x: 0,
      right: item.width,
      text: trimmed,
    });

    y += LINE_STEP;
  }

  return lines;
}
