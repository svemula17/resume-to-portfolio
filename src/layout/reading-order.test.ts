import { describe, expect, it } from "vitest";
import { orderPage, toPlainText } from "./reading-order";
import { column, item, page } from "../test/factories";

describe("orderPage", () => {
  it("emits full-width header, then all of the left column, then all of the right", () => {
    const header = [
      item("SAI KUMAR VEMULA", 72, 60, { width: 468, bold: true }),
      item("sai@example.com  ·  555-0100  ·  Austin, TX", 72, 82, { width: 468 }),
    ];
    const left = column(
      ["SKILLS", "TypeScript", "React", "Go", "Kubernetes", "AWS", "EDUCATION"],
      50,
      140,
      { width: 140 },
    );
    const right = column(
      [
        "EXPERIENCE",
        "Staff Engineer, Acme",
        "Owned the payments platform",
        "Led a team of six engineers",
        "Engineer, Initech",
        "Wrote the migration tooling",
        "Kept the lights on",
      ],
      330,
      146,
      { width: 230 },
    );

    const ordered = orderPage(page([...right, ...left, ...header]));

    expect(ordered.layout.type).toBe("two-column");
    expect(ordered.lines.map((line) => line.text)).toEqual([
      "SAI KUMAR VEMULA",
      "sai@example.com · 555-0100 · Austin, TX",
      "SKILLS",
      "TypeScript",
      "React",
      "Go",
      "Kubernetes",
      "AWS",
      "EDUCATION",
      "EXPERIENCE",
      "Staff Engineer, Acme",
      "Owned the payments platform",
      "Led a team of six engineers",
      "Engineer, Initech",
      "Wrote the migration tooling",
      "Kept the lights on",
    ]);
  });

  it("does not interleave the two columns by vertical position", () => {
    // If ordering were by y, "EXPERIENCE" would land between the two skills.
    const ordered = orderPage(
      page([
        ...column(["SKILLS", "TypeScript", "React", "Go", "Rust"], 50, 100, { width: 140 }),
        ...column(
          ["EXPERIENCE", "Acme", "Built things", "Globex", "Fixed things"],
          330,
          108,
          { width: 230 },
        ),
      ]),
    );

    const texts = ordered.lines.map((line) => line.text);
    expect(texts.indexOf("Rust")).toBeLessThan(texts.indexOf("EXPERIENCE"));
  });
});

describe("toPlainText", () => {
  it("concatenates pages in document order", () => {
    const first = page(column(["page one line", "still page one"], 72, 100, { width: 200 }), {
      pageNumber: 1,
    });
    const second = page(column(["page two line"], 72, 100, { width: 200 }), {
      pageNumber: 2,
    });

    expect(toPlainText([first, second])).toBe(
      "page one line\nstill page one\npage two line",
    );
  });

  it("decides layout per page rather than carrying page 1's decision forward", () => {
    const twoColumn = page(
      [
        ...column(["SKILLS", "TypeScript", "React", "Go", "Rust"], 50, 100, { width: 140 }),
        ...column(["EXPERIENCE", "Acme", "Built things", "Globex", "Fixed"], 330, 108, {
          width: 230,
        }),
      ],
      { pageNumber: 1 },
    );
    const singleColumn = page(
      column(["PUBLICATIONS", "A paper about a thing", "Another paper"], 72, 100, {
        width: 400,
      }),
      { pageNumber: 2 },
    );

    const text = toPlainText([twoColumn, singleColumn]);
    expect(text.endsWith("PUBLICATIONS\nA paper about a thing\nAnother paper")).toBe(true);
  });
});
