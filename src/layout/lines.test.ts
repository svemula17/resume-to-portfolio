import { describe, expect, it } from "vitest";
import { averageCharWidth, groupIntoLines } from "./lines";
import { item, page } from "../test/factories";

describe("averageCharWidth", () => {
  it("excludes bold items, which are wider per character", () => {
    const narrow = item("aaaaaaaaaa", 0, 0, { width: 50 });
    const wideBold = item("aaaaaaaaaa", 0, 20, { width: 150, bold: true });

    expect(averageCharWidth([narrow, wideBold])).toBe(5);
  });

  it("falls back to measuring bold items when a page has nothing else", () => {
    const onlyBold = item("NAME", 0, 0, { width: 40, bold: true });
    expect(averageCharWidth([onlyBold])).toBe(10);
  });

  it("returns 0 rather than NaN for an empty page", () => {
    expect(averageCharWidth([])).toBe(0);
  });
});

describe("groupIntoLines", () => {
  it("reassembles a phone number pdf.js split into three items", () => {
    // The canonical case. Each fragment is positioned separately in the
    // content stream but the gaps are sub-character, so it is one run.
    const items = [
      item("(555)", 72, 100, { width: 26 }),
      item(" 555-", 98.4, 100, { width: 26 }),
      item("0100", 124.6, 100, { width: 22 }),
      item("body text for the average", 72, 120, { width: 137.5 }),
    ];

    const lines = groupIntoLines(page(items));

    expect(lines).toHaveLength(2);
    expect(lines[0]!.text).toBe("(555) 555-0100");
  });

  it("keeps items separated by a real gap apart", () => {
    const items = [
      item("Acme Corporation", 72, 100, { width: 88 }),
      item("Jan 2020 - Present", 420, 100, { width: 99 }),
      item("filler text to set the average width", 72, 120, { width: 198 }),
    ];

    const lines = groupIntoLines(page(items));

    expect(lines[0]!.items).toHaveLength(2);
    // A cell gap survives as three spaces, the delimiter the parser uses.
    expect(lines[0]!.text).toBe("Acme Corporation   Jan 2020 - Present");
  });

  it("groups items sharing a baseline and orders lines top to bottom", () => {
    const items = [
      item("third", 72, 140, { width: 30 }),
      item("first", 72, 100, { width: 30 }),
      item("second", 72, 120, { width: 36 }),
    ];

    expect(groupIntoLines(page(items)).map((line) => line.text)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("tolerates a baseline that differs by rounding", () => {
    const items = [
      item("Senior Engineer", 72, 100, { width: 82 }),
      item("Acme", 300, 100.4, { width: 28 }),
    ];

    expect(groupIntoLines(page(items))).toHaveLength(1);
  });

  it("marks a line bold only when every item on it is bold", () => {
    const allBold = page([
      item("EXPERIENCE", 72, 100, { width: 66, bold: true }),
    ]);
    const mixed = page([
      item("Role:", 72, 100, { width: 28, bold: true }),
      item("Senior Engineer", 300, 100, { width: 82 }),
    ]);

    expect(groupIntoLines(allBold)[0]!.isBold).toBe(true);
    expect(groupIntoLines(mixed)[0]!.isBold).toBe(false);
  });

  it("measures the average across the whole page when grouping a subset", () => {
    // A narrow sidebar must not get its own, skewed merge threshold.
    const sidebar = [item("React", 50, 100, { width: 28 })];
    const body = [item("a long line of ordinary body text", 300, 100, { width: 180 })];
    const full = page([...sidebar, ...body]);

    expect(groupIntoLines(full, sidebar)).toHaveLength(1);
  });
});
