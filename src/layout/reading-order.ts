/**
 * Turn extracted pages into lines in the order a human would read them.
 *
 * This is the whole point of the layout stage: everything downstream — section
 * detection, subsection splitting, every field parser — assumes it is reading
 * the resume top to bottom the way it was written. Get this wrong and no
 * amount of parser cleverness recovers.
 */
import type { Page } from "../extract/types";
import { detectColumns } from "./columns";
import { groupIntoLines } from "./lines";
import type { ColumnLayout, Line } from "./types";

/** A page's lines plus the layout decision that produced them, for debugging. */
export interface PageReadingOrder {
  pageNumber: number;
  layout: ColumnLayout;
  lines: Line[];
}

/**
 * Order one page: full-width items first, then the entire left column, then
 * the entire right column.
 *
 * Columns are emitted whole rather than interleaved by y, because a sidebar
 * and a main column are separate documents that happen to share a sheet of
 * paper. Interleaving them by vertical position would cut a work entry in
 * half to insert a skills heading.
 */
export function orderPage(page: Page): PageReadingOrder {
  const layout = detectColumns(page);

  if (layout.type === "single") {
    return { pageNumber: page.pageNumber, layout, lines: groupIntoLines(page) };
  }

  return {
    pageNumber: page.pageNumber,
    layout,
    lines: [
      ...groupIntoLines(page, layout.fullWidthItems),
      ...groupIntoLines(page, layout.leftItems),
      ...groupIntoLines(page, layout.rightItems),
    ],
  };
}

/** Per-page ordering, kept separate so the debug view can show the decision. */
export function toPageReadingOrders(pages: Page[]): PageReadingOrder[] {
  return pages.map(orderPage);
}

/**
 * Every page in document order, flattened.
 *
 * Pages are concatenated rather than merged. A two-column page followed by a
 * single-column page is normal — a layout decision on page 1 says nothing
 * about page 2, and carrying one over would be a guess dressed up as
 * consistency.
 */
export function toReadingOrder(pages: Page[]): Line[] {
  return toPageReadingOrders(pages).flatMap((page) => page.lines);
}

/** Reconstructed plain text, one line per visual line. */
export function toPlainText(pages: Page[]): string {
  return toReadingOrder(pages)
    .map((line) => line.text)
    .join("\n");
}
