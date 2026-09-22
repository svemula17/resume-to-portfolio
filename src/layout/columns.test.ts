import { describe, expect, it } from "vitest";
import {
  buildCoverageHistogram,
  detectColumns,
  findEmptyRuns,
  findGutterCandidate,
} from "./columns";
import { column, item, page, PAGE_WIDTH } from "../test/factories";

describe("buildCoverageHistogram", () => {
  it("marks every bucket an item spans", () => {
    const buckets = buildCoverageHistogram([item("x", 100, 50, { width: 40 })], PAGE_WIDTH);

    expect(buckets[99]).toBe(0);
    expect(buckets[100]).toBe(1);
    expect(buckets[120]).toBe(1);
    expect(buckets[140]).toBe(1);
    expect(buckets[141]).toBe(0);
  });

  it("counts overlapping items cumulatively", () => {
    const buckets = buildCoverageHistogram(
      [item("a", 100, 50, { width: 40 }), item("b", 120, 70, { width: 40 })],
      PAGE_WIDTH,
    );

    expect(buckets[130]).toBe(2);
  });

  it("still occupies a bucket for a zero-width item", () => {
    // Some PDFs report width 0 for single glyphs. Contributing nothing would
    // punch a one-point hole that a naive widest-gap search could latch onto.
    const buckets = buildCoverageHistogram([item("i", 300, 50, { width: 0 })], PAGE_WIDTH);
    expect(buckets[300]).toBe(1);
  });
});

describe("findEmptyRuns", () => {
  it("returns runs between covered regions but not the trailing margin", () => {
    const buckets = new Uint32Array([1, 1, 0, 0, 0, 1, 1, 0, 0]);
    const gaps = findEmptyRuns(buckets);

    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ start: 2, end: 5, width: 3 });
  });
});

describe("findGutterCandidate", () => {
  it("ignores a wide gap sitting outside the middle band", () => {
    // A deep left indent: wide whitespace, but nowhere near the page centre.
    const items = [
      ...column(["a", "b", "c"], 40, 100, { width: 20 }),
      ...column(["d", "e", "f"], 300, 100, { width: 250 }),
    ];

    const gap = findGutterCandidate(items, PAGE_WIDTH);
    // The 60..300 gap is centred at 180, left of the 0.2 * 612 = 122pt zone
    // start but the search still requires the centre inside the band.
    expect(gap === null || (gap.centre >= 122 && gap.centre <= 490)).toBe(true);
  });

  it("ignores a gap narrower than the minimum gutter", () => {
    const items = [
      ...column(["left"], 100, 100, { width: 200 }),
      ...column(["right"], 308, 100, { width: 200 }),
    ];

    expect(findGutterCandidate(items, PAGE_WIDTH)).toBeNull();
  });
});

describe("detectColumns", () => {
  it("reads a clean two-column page as two columns", () => {
    const left = column(
      ["SKILLS", "TypeScript", "React", "Node", "Postgres", "EDUCATION", "BSc Computer Science"],
      50,
      120,
      { width: 140 },
    );
    const right = column(
      [
        "EXPERIENCE",
        "Senior Engineer, Acme",
        "Built the thing that does the thing",
        "Shipped it on time",
        "Engineer, Globex",
        "Maintained a large service",
        "Reduced latency substantially",
      ],
      330,
      126,
      { width: 230 },
    );

    const layout = detectColumns(page([...left, ...right]));

    expect(layout.type).toBe("two-column");
    if (layout.type !== "two-column") return;
    expect(layout.gutterX).toBeGreaterThan(190);
    expect(layout.gutterX).toBeLessThan(330);
    expect(layout.leftItems).toHaveLength(left.length);
    expect(layout.rightItems).toHaveLength(right.length);
    expect(layout.fullWidthItems).toHaveLength(0);
  });

  it("reads an ordinary single-column page as single", () => {
    const items = column(
      [
        "SAI KUMAR VEMULA",
        "Senior Software Engineer",
        "EXPERIENCE",
        "Acme Corporation",
        "Built and maintained the billing pipeline end to end",
        "Cut month-end close time from three days to four hours",
        "EDUCATION",
        "BSc Computer Science",
      ],
      72,
      100,
      { width: 400 },
    );

    expect(detectColumns(page(items)).type).toBe("single");
  });

  it("finds the gutter under a full-width header", () => {
    // The header spans the whole page and fills the buckets the gutter would
    // occupy. Without the header-band retry this page reads as single.
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

    const layout = detectColumns(page([...header, ...left, ...right]));

    expect(layout.type).toBe("two-column");
    if (layout.type !== "two-column") return;
    expect(layout.fullWidthItems).toHaveLength(2);
    expect(layout.leftItems).toHaveLength(left.length);
    expect(layout.rightItems).toHaveLength(right.length);
  });

  it("keeps a right-aligned date column as a single column", () => {
    // The near-miss that matters most: "Company .......... Jan 2020 - Present".
    // There IS a wide empty band down the middle, but almost every line has
    // content on both sides of it, so it is a tab stop and not a gutter.
    const items = [
      item("EXPERIENCE", 72, 100, { width: 90, bold: true }),
      item("Acme Corporation", 72, 122, { width: 110 }),
      item("Jan 2020 - Present", 420, 122, { width: 120 }),
      item("Senior Engineer", 72, 138, { width: 100 }),
      item("Austin, TX", 420, 138, { width: 70 }),
      item("Globex Corporation", 72, 176, { width: 120 }),
      item("Mar 2017 - Dec 2019", 420, 176, { width: 130 }),
      item("Engineer", 72, 192, { width: 60 }),
      item("Remote", 420, 192, { width: 50 }),
      item("Initech", 72, 230, { width: 50 }),
      item("Jun 2015 - Feb 2017", 420, 230, { width: 130 }),
      item("Junior Engineer", 72, 246, { width: 100 }),
      item("Dallas, TX", 420, 246, { width: 70 }),
    ];

    expect(detectColumns(page(items)).type).toBe("single");
  });

  it("does not promote a thin sidebar of stray items to a column", () => {
    const body = column(
      [
        "EXPERIENCE",
        "Acme Corporation, Senior Engineer",
        "Built the billing pipeline end to end",
        "Cut close time from three days to four hours",
        "Globex, Engineer",
        "Kept a large service healthy",
      ],
      72,
      100,
      { width: 300 },
    );
    const strays = [item("1", 540, 700, { width: 6 })];

    expect(detectColumns(page([...body, ...strays])).type).toBe("single");
  });

  it("accepts aligned rows when the gutter is tight", () => {
    // A sidebar and a main column laid out on a shared grid: every row
    // straddles the gap, so the straddle ratio alone would reject this. The
    // gutter is 30pt — typographic, not tab-stop slack — so it is a column.
    const left = column(
      ["SKILLS", "TypeScript", "React", "Go", "Kubernetes", "AWS", "Terraform"],
      50,
      140,
      { width: 130 },
    );
    const right = column(
      [
        "EXPERIENCE",
        "Staff Engineer, Acme Corp",
        "Owned the payments platform",
        "Led a team of six engineers",
        "Engineer, Initech",
        "Wrote the migration tooling",
        "Kept the lights on",
      ],
      210,
      140,
      { width: 330 },
    );

    const layout = detectColumns(page([...left, ...right]));
    expect(layout.type).toBe("two-column");
    if (layout.type !== "two-column") return;
    expect(layout.gutterEnd - layout.gutterStart).toBeLessThan(612 * 0.08);
  });

  it("still rejects aligned rows when the band is tab-stop wide", () => {
    // Same row alignment, but the gap is 220pt. That is not a gutter, it is
    // the slack in front of a right-hand tab stop.
    const left = column(
      ["Acme Corporation", "Globex", "Initech", "Umbrella", "Stark", "Wayne", "Cyberdyne"],
      72,
      140,
      { width: 110 },
    );
    const right = column(
      [
        "Jan 2020 - Present",
        "Mar 2017 - Dec 2019",
        "Jun 2015 - Feb 2017",
        "Jan 2014 - May 2015",
        "Sep 2012 - Dec 2013",
        "Jun 2011 - Aug 2012",
        "Jan 2010 - May 2011",
      ],
      420,
      140,
      { width: 120 },
    );

    expect(detectColumns(page([...left, ...right])).type).toBe("single");
  });

  it("returns single for an empty page rather than throwing", () => {
    expect(detectColumns(page([])).type).toBe("single");
  });
});
