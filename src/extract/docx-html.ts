/**
 * mammoth's HTML → the text shape the parser expects.
 *
 * extractRawText was the obvious choice and the wrong one. It drops list
 * markers — a Word bullet is numbering, not a character — so every bullet
 * arrived as a heading line; and it puts a blank line after every
 * paragraph, which the entry splitter reads as a boundary each time.
 * convertToHtml keeps what raw text loses: <li> for bullets, <table> for
 * layout, tabs for right-aligned dates. This module reads that HTML back
 * into lines, and the rules for tables are the only judgement in it.
 *
 * A table with tall cells is a layout: a sidebar beside a main column,
 * each cell a stack of paragraphs. A reader reads the sidebar top to
 * bottom and then the main column, so the cells are emitted column by
 * column. A table with one-line cells is a grid of rows — a date beside
 * an entry, a skill beside its level — and each row is one line with a
 * cell gap between the cells, exactly as the PDF path renders a rail.
 *
 * This is a parser of mammoth's output, not of arbitrary HTML. mammoth
 * emits a small, regular vocabulary, and the text of every element is
 * taken as text; no markup ever reaches the DOM.
 */

/** Cells averaging more paragraphs than this are a layout, not a grid. */
const LAYOUT_CELL_PARAGRAPHS = 3;

/** The cell gap the layout stage uses for a tabbed row. */
const CELL_GAP = "   ";

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) return String.fromCodePoint(parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(parseInt(entity.slice(1), 10));
    return ENTITIES[entity.toLowerCase()] ?? whole;
  });
}

/** Inline content of one block, with tags dropped and tabs as cell gaps. */
function inlineText(html: string): string {
  const text = decode(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""));
  return (
    text
      // Ordinary runs of spaces collapse first; the tab becomes a cell gap
      // after, or the gap would collapse along with them.
      .replace(/[ \u00a0]+/g, " ")
      .replace(/ ?\t+ ?/g, CELL_GAP)
      .replace(/ ?\n ?/g, "\n")
      .trim()
  );
}

/** Split a block's inline text on <br>, so a line break inside a paragraph is a line. */
function blockLines(html: string, prefix = ""): string[] {
  return inlineText(html)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => (index === 0 ? prefix + line : line));
}

/** The lines of a run of block elements, in order. */
function blocksToLines(html: string): string[] {
  const lines: string[] = [];
  const block = /<(p|h[1-6]|li|table)(\s[^>]*)?>([\s\S]*?)<\/\1>|<table[\s\S]*?<\/table>/gi;
  let match: RegExpExecArray | null;
  let cursor = 0;

  const flushStray = (until: number) => {
    // Text between blocks — mammoth rarely emits any — is still text.
    const stray = html.slice(cursor, until);
    if (stray.trim()) lines.push(...blockLines(stray));
  };

  while ((match = block.exec(html)) !== null) {
    flushStray(match.index);
    cursor = match.index + match[0].length;
    const tag = (match[1] ?? "table").toLowerCase();
    const inner = match[3] ?? match[0];
    if (tag === "table") {
      lines.push(...tableToLines(match[0]));
    } else if (tag === "li") {
      lines.push(...blockLines(inner, "• "));
    } else {
      lines.push(...blockLines(inner));
    }
  }
  flushStray(html.length);
  return lines;
}

function tableToLines(tableHtml: string): string[] {
  const rows: string[][][] = [];
  const rowPattern = /<tr(\s[^>]*)?>([\s\S]*?)<\/tr>/gi;
  let row: RegExpExecArray | null;
  while ((row = rowPattern.exec(tableHtml)) !== null) {
    const cells: string[][] = [];
    const cellPattern = /<t[dh](\s[^>]*)?>([\s\S]*?)<\/t[dh]>/gi;
    let cell: RegExpExecArray | null;
    while ((cell = cellPattern.exec(row[2] ?? "")) !== null) {
      cells.push(blocksToLines(cell[2] ?? ""));
    }
    if (cells.length > 0) rows.push(cells);
  }
  if (rows.length === 0) return [];

  const cellCount = rows.reduce((n, cells) => n + cells.length, 0);
  const lineCount = rows.reduce((n, cells) => n + cells.reduce((m, cell) => m + cell.length, 0), 0);
  const layout = lineCount / cellCount > LAYOUT_CELL_PARAGRAPHS;

  if (layout) {
    // Column by column: every row's first cell, then every row's second.
    const columns = Math.max(...rows.map((cells) => cells.length));
    const out: string[] = [];
    for (let column = 0; column < columns; column += 1) {
      for (const cells of rows) out.push(...(cells[column] ?? []));
    }
    return out;
  }

  // Row by row, cells joined with a cell gap; a multi-line cell keeps its
  // extra lines under the row.
  const out: string[] = [];
  for (const cells of rows) {
    const firsts = cells.map((cell) => cell[0] ?? "").filter(Boolean);
    if (firsts.length > 0) out.push(firsts.join(CELL_GAP));
    for (const cell of cells) out.push(...cell.slice(1));
  }
  return out;
}

/**
 * Lines of text from mammoth HTML, one per paragraph, bullets marked with
 * "•", table cells arranged as a reader would read them.
 */
export function htmlToLines(html: string): string[] {
  return blocksToLines(html);
}

export function htmlToText(html: string): string {
  return htmlToLines(html).join("\n");
}
