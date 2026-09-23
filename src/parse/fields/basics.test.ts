import { describe, expect, it } from "vitest";
import { parseBasics, parseLinks, parseLocation, parseName, parseTitle } from "./basics";
import { linesFromText } from "../from-text";

const PREAMBLE = linesFromText(
  `SAI KUMAR VEMULA
Jersey City, NJ | 917-516-6967 | svemula127@gmail.com
linkedin.com/in/saikumar-cybersecurity | github.com/svemula17 | svemula17.github.io/sai-portfolio`,
);

describe("parseName", () => {
  it("picks the name over the contact and link lines", () => {
    const result = parseName(PREAMBLE);
    expect(result.value).toBe("SAI KUMAR VEMULA");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("works on a title-case name", () => {
    expect(parseName(linesFromText("Jane Doe\njane@example.com")).value).toBe("Jane Doe");
  });

  it("does not pick a line containing an address", () => {
    const result = parseName(linesFromText("Austin, TX\nJane Doe\njane@example.com"));
    expect(result.value).toBe("Jane Doe");
  });

  it("returns undefined rather than guessing from an empty preamble", () => {
    expect(parseName([]).value).toBeUndefined();
  });
});

describe("parseTitle", () => {
  it("takes the line under the name when it is a plain job title", () => {
    const lines = linesFromText("Jane Doe\nSenior Software Engineer\njane@example.com");
    expect(parseTitle(lines, "Jane Doe").value).toBe("Senior Software Engineer");
  });

  it("refuses to promote a contact line to a job title", () => {
    expect(parseTitle(PREAMBLE, "SAI KUMAR VEMULA").value).toBeUndefined();
  });
});

describe("parseLocation", () => {
  it("prefers an unambiguous City, ST over a looser match", () => {
    expect(parseLocation(PREAMBLE).value).toBe("Jersey City, NJ");
  });

  it("falls back to City, Country with lower confidence", () => {
    const result = parseLocation(linesFromText("Mumbai, India | jane@example.com"));
    expect(result.value).toBe("Mumbai, India");
    expect(result.confidence).toBeLessThan(0.8);
  });
});

describe("parseLinks", () => {
  it("labels known hosts and de-duplicates", () => {
    const result = parseLinks(PREAMBLE);
    expect(result.value).toEqual([
      { label: "LinkedIn", url: "linkedin.com/in/saikumar-cybersecurity" },
      { label: "GitHub", url: "github.com/svemula17" },
      { label: "svemula17.github.io", url: "svemula17.github.io/sai-portfolio" },
    ]);
  });

  it("does not treat an email address as a link", () => {
    const result = parseLinks(linesFromText("jane@example.com | github.com/jane"));
    expect(result.value?.map((link) => link.url)).toEqual(["github.com/jane"]);
  });
});

describe("parseBasics", () => {
  it("fills every field from a realistic contact block", () => {
    const { basics, confidence } = parseBasics(PREAMBLE);

    expect(basics.name).toBe("SAI KUMAR VEMULA");
    expect(basics.email).toBe("svemula127@gmail.com");
    expect(basics.phone).toBe("917-516-6967");
    expect(basics.location).toBe("Jersey City, NJ");
    expect(basics.links).toHaveLength(3);
    expect(confidence["basics.name"]).toBeGreaterThan(0.7);
  });

  it("produces a schema-shaped object even from nothing", () => {
    const { basics } = parseBasics([]);
    expect(basics.name).toBe("");
    expect(basics.links).toEqual([]);
  });
});
