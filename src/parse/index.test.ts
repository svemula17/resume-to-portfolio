import { describe, expect, it } from "vitest";
import { entriesOf, linesFromText, parseText } from "./index";
import { CONFIDENCE_REVIEW_THRESHOLD } from "../schema/resume";

describe("parseText", () => {
  it("returns a schema-valid resume from an empty string", () => {
    const result = parseText("");
    expect(result.data.basics.name).toBe("Unknown");
    expect(result.confidence["basics.name"]).toBe(0);
  });

  it("returns a schema-valid resume from noise", () => {
    const result = parseText("!!! ??? 123 456\n\n\n---");
    expect(result.data.experience).toEqual([]);
    expect(result.data.skills).toEqual([]);
  });

  it("keys every confidence entry to a real field path", () => {
    const result = parseText(`Jane Doe
jane@example.com

EXPERIENCE
Engineer
Acme Inc. | 2020 - 2021
- Did things.`);

    for (const key of Object.keys(result.confidence)) {
      expect(key).toMatch(/^(basics|experience|education|projects|skills|certifications)\./);
    }
  });

  it("flags a bare unlabelled skills line for review", () => {
    const result = parseText("Jane Doe\n\nSKILLS\nGo, Python");
    expect(result.confidence["skills.0.items"]).toBeLessThan(CONFIDENCE_REVIEW_THRESHOLD);
  });

  it("keeps unknown and unparsed sections as leftover text", () => {
    const result = parseText(`Jane Doe

EXPERIENCE
Engineer
Acme Inc. | 2020 - 2021

MY TOOLBOX
Go, Python

VOLUNTEER
Code mentor at a local school`);

    expect(result.leftover).toEqual([
      { heading: "MY TOOLBOX", lines: ["Go, Python"] },
      { heading: "VOLUNTEER", lines: ["Code mentor at a local school"] },
    ]);
  });

  it("keeps paragraph breaks in leftover text so it re-parses into entries", () => {
    const result = parseText(`Jane Doe
jane@example.com
Austin, TX

SIDE WORK
Ledger
An append-only ledger.

Vigil
A prompt-injection monitor.

Spidey
A crawler.`);

    const block = result.leftover[0]!;
    expect(block.lines).toEqual([
      "Ledger",
      "An append-only ledger.",
      "",
      "Vigil",
      "A prompt-injection monitor.",
      "",
      "Spidey",
      "A crawler.",
    ]);

    // The round trip is the property that matters: a block the review form
    // hands back to the parser must split the same way it did the first time.
    const reparsed = entriesOf(linesFromText(block.lines.join("\n")));
    expect(reparsed).toHaveLength(3);
  });

  it("splits education entries with the date on the first line and no gaps", () => {
    // "School | dates / Degree" twice, no blank line between. Gap splitting
    // sees one entry; one-date-per-entry has to find two, and the second
    // entry's degree must not be handed to the first.
    const result = parseText(`Jane Doe
jane@example.com

EDUCATION
Columbia University 2015 – 2017
MS Computer Science, Data Systems
Boston University 2008 – 2012
BS Computer Engineering — GPA 3.7/4.0`);

    expect(result.data.education).toHaveLength(2);
    expect(result.data.education[0]!.degree).toContain("MS Computer Science");
    expect(result.data.education[1]!.school).toContain("Boston University");
    expect(result.data.education[1]!.degree).toContain("BS Computer Engineering");
  });

  it("finds job boundaries on the text path without whitespace between them", () => {
    // No blank lines anywhere: gap-based splitting sees one entry, and the
    // heading-after-bullet fallback has to find the second job.
    const result = parseText(`Jane Doe
EXPERIENCE
Staff Engineer
Acme Inc. | 2021 - Present
- Led things.
Software Engineer
Globex Inc. | 2017 - 2020
- Built things.`);

    expect(result.data.experience).toHaveLength(2);
    expect(result.data.experience[1]!.company).toBe("Globex Inc.");
  });
});
