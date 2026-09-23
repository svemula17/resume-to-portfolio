import { describe, expect, it } from "vitest";
import { findHeadings, matchHeadingKeyword, splitIntoSections } from "./sections";
import { linesFromText } from "./from-text";

const RESUME = `SAI KUMAR VEMULA
Jersey City, NJ | 917-516-6967 | sai@example.com
PROFESSIONAL SUMMARY
Security engineer with five years of experience.
PROFESSIONAL EXPERIENCE
DevSecOps Engineer
Datadog -- United States | June 2025 - Present
EDUCATION
MS Cybersecurity
TECHNICAL SKILLS
Languages: Python, Go, TypeScript`;

describe("matchHeadingKeyword", () => {
  it("maps the common aliases onto one kind each", () => {
    expect(matchHeadingKeyword("Work Experience")).toBe("experience");
    expect(matchHeadingKeyword("PROFESSIONAL EXPERIENCE")).toBe("experience");
    expect(matchHeadingKeyword("Employment History")).toBe("experience");
    expect(matchHeadingKeyword("Core Competencies")).toBe("skills");
    expect(matchHeadingKeyword("Objective:")).toBe("summary");
  });

  it("does not match a job title that merely contains a keyword", () => {
    expect(matchHeadingKeyword("Experience with distributed systems")).toBeNull();
    expect(matchHeadingKeyword("Education Technology Lead")).toBeNull();
  });
});

describe("findHeadings", () => {
  it("finds every heading in a realistic resume", () => {
    const hits = findHeadings(linesFromText(RESUME));
    expect(hits.map((hit) => hit.kind)).toEqual([
      "summary",
      "experience",
      "education",
      "skills",
    ]);
  });

  it("does not mistake an all-caps name for a heading", () => {
    // The case structural detection is suppressed for. "SAI KUMAR VEMULA" is
    // alone on its line and all-caps, exactly like "EXPERIENCE".
    const hits = findHeadings(linesFromText(RESUME));
    expect(hits.some((hit) => hit.text.includes("SAI KUMAR"))).toBe(false);
  });

  it("picks up an unknown all-caps heading structurally", () => {
    const hits = findHeadings(
      linesFromText("Name Here\nline two\nline three\nEXPERIENCE\nAcme\nMY TOOLBOX\nGo"),
    );
    expect(hits.map((hit) => [hit.kind, hit.text])).toEqual([
      ["experience", "EXPERIENCE"],
      ["unknown", "MY TOOLBOX"],
    ]);
  });

  it("ignores a long capitalised line that is really a sentence", () => {
    const hits = findHeadings(
      linesFromText("a\nb\nc\nBUILT AND MAINTAINED THE BILLING PIPELINE END TO END"),
    );
    expect(hits).toHaveLength(0);
  });
});

describe("splitIntoSections", () => {
  const sections = splitIntoSections(linesFromText(RESUME));

  it("puts everything above the first heading in a null-heading preamble", () => {
    expect(sections[0]!.heading).toBeNull();
    expect(sections[0]!.lines.map((line) => line.text)).toEqual([
      "SAI KUMAR VEMULA",
      "Jersey City, NJ | 917-516-6967 | sai@example.com",
    ]);
  });

  it("excludes the heading line from its own section's content", () => {
    const experience = sections.find((section) => section.kind === "experience");
    expect(experience!.lines.map((line) => line.text)).toEqual([
      "DevSecOps Engineer",
      "Datadog -- United States | June 2025 - Present",
    ]);
  });

  it("ends a section where the next heading starts", () => {
    const education = sections.find((section) => section.kind === "education");
    expect(education!.lines.map((line) => line.text)).toEqual(["MS Cybersecurity"]);
  });
});
