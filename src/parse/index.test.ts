import { describe, expect, it } from "vitest";
import { parseText } from "./index";
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
