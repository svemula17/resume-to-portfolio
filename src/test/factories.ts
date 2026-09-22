/**
 * Builders for synthetic pages.
 *
 * The layout code is pure and geometry-only, so it can be tested without a
 * single real PDF. That matters: the four cases that decide whether column
 * detection is correct — clean two-column, single-column, two-column with a
 * full-width header, and a near-miss that must stay single — are far easier
 * to state as coordinates than to source as documents.
 *
 * Letter portrait at 1x scale, which is what pdf.js reports for almost every
 * resume.
 */
import type { Page, TextItem } from "../extract/types";

export const PAGE_WIDTH = 612;
export const PAGE_HEIGHT = 792;

/** Roughly 11pt text: ~5.5pt per character, 13pt leading. */
const CHAR_WIDTH = 5.5;
const LINE_HEIGHT = 11;

export function item(
  str: string,
  x: number,
  y: number,
  options: { width?: number; bold?: boolean; height?: number } = {},
): TextItem {
  return {
    str,
    x,
    y,
    width: options.width ?? str.length * CHAR_WIDTH,
    height: options.height ?? LINE_HEIGHT,
    fontName: options.bold ? "g_d0_f2" : "g_d0_f1",
    bold: options.bold ?? false,
  };
}

export function page(items: TextItem[], overrides: Partial<Page> = {}): Page {
  return {
    pageNumber: 1,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    items,
    imageOnly: items.length === 0,
    ...overrides,
  };
}

/** A stack of lines down one x position, starting at y and stepping down. */
export function column(
  texts: string[],
  x: number,
  startY: number,
  options: { width?: number; step?: number } = {},
): TextItem[] {
  const step = options.step ?? 16;
  return texts.map((text, index) =>
    item(text, x, startY + index * step, { width: options.width }),
  );
}
