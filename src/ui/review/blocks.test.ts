import { describe, expect, it } from "vitest";
import { parseBlockAs } from "./blocks";

/** Every key an entry carries is relative to its own section and index. */
function expectRelativeKeys(entries: Array<{ confidence: Record<string, number> }>, path: string): void {
  entries.forEach((entry, index) => {
    const keys = Object.keys(entry.confidence);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) expect(key).toMatch(new RegExp(`^${path}\\.${index}\\.[a-zA-Z]+$`));
  });
}

describe("parseBlockAs: the heading rule", () => {
  const AI_SECURITY = `Vigil
Runtime guard for LLM tool calls.
Tech: Go, eBPF

Sentinel
Prompt-injection scanner for CI.
Tech: Python

Ledger
Audit log viewer. github.com/x/ledger`;

  it("splits a three-paragraph block into three projects and drops the section heading", () => {
    const entries = parseBlockAs("projects", AI_SECURITY, "AI SECURITY — BUILT & PUBLISHED");

    expect(entries).toHaveLength(3);
    expect(entries.map((entry) => entry.value.name)).toEqual(["Vigil", "Sentinel", "Ledger"]);
    expect(entries[0]!.value).toEqual({
      name: "Vigil",
      description: "Runtime guard for LLM tool calls.",
      tech: ["Go", "eBPF"],
    });
    expect(entries[2]!.value.url).toBe("github.com/x/ledger");

    const names = entries.map((entry) => entry.value.name);
    expect(names).not.toContain("AI SECURITY — BUILT & PUBLISHED");
    expect(JSON.stringify(entries)).not.toContain("AI SECURITY");
  });

  it("gives a single-paragraph block its heading back as the project name", () => {
    const entries = parseBlockAs("projects", "Runtime guard for LLM tool calls.\nTech: Go, eBPF", "VIGIL");

    expect(entries).toHaveLength(1);
    expect(entries[0]!.value).toEqual({
      name: "VIGIL",
      description: "Runtime guard for LLM tool calls.",
      tech: ["Go", "eBPF"],
    });
    expect(entries[0]!.confidence["projects.0.name"]).toBe(0.7);
  });

  it("uses no heading when none is given", () => {
    const entries = parseBlockAs("projects", "Runtime guard for LLM tool calls.\nTech: Go, eBPF");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.value.name).toBe("Runtime guard for LLM tool calls.");
  });

  it("keys project confidence relative to the block", () => {
    const entries = parseBlockAs("projects", AI_SECURITY, "AI SECURITY — BUILT & PUBLISHED");
    expectRelativeKeys(entries, "projects");
    expect(entries[1]!.confidence).toEqual({
      "projects.1.name": 0.7,
      "projects.1.description": 0.75,
      "projects.1.tech": 0.8,
    });
  });
});

describe("parseBlockAs: experience", () => {
  it("splits two jobs on a blank line and reads their dates", () => {
    const entries = parseBlockAs(
      "experience",
      `Staff Engineer
Acme Inc. | Jan 2021 - Present
- Led things.
- Shipped stuff.

Engineer
Globex | 2018 - 2020
- Built things.`,
    );

    expect(entries).toHaveLength(2);
    expect(entries[0]!.value).toEqual({
      role: "Staff Engineer",
      company: "Acme Inc.",
      startDate: "Jan 2021",
      current: true,
      bullets: ["Led things.", "Shipped stuff."],
    });
    expect(entries[1]!.value).toEqual({
      role: "Engineer",
      company: "Globex",
      startDate: "2018",
      endDate: "2020",
      current: false,
      bullets: ["Built things."],
    });
    expectRelativeKeys(entries, "experience");
    expect(entries[1]!.confidence["experience.1.startDate"]).toBe(0.9);
    expect(entries[1]!.confidence["experience.1.bullets"]).toBe(0.95);
  });

  it("splits two jobs with no blank line where a heading follows a bullet", () => {
    const entries = parseBlockAs(
      "experience",
      `Staff Engineer
Acme Inc. | Jan 2021 - Present
- Led things.
- Shipped stuff.
Engineer
Globex | 2018 - 2020
- Built things.`,
    );

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.value.role)).toEqual(["Staff Engineer", "Engineer"]);
    expect(entries.map((entry) => entry.value.company)).toEqual(["Acme Inc.", "Globex"]);
    expect(entries[0]!.value.bullets).toEqual(["Led things.", "Shipped stuff."]);
    expect(entries[1]!.value.bullets).toEqual(["Built things."]);
  });

  it("uses the loose split even when no date range marks the second job", () => {
    // The main parser's fallback only fires when it counts more date ranges
    // than entries; with none at all, only the loose split can find the seam.
    const entries = parseBlockAs(
      "experience",
      `Staff Engineer
Acme Inc.
- Led things.
Engineer
Globex
- Built things.`,
    );

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.value.role)).toEqual(["Staff Engineer", "Engineer"]);
    expect(entries.map((entry) => entry.value.bullets)).toEqual([["Led things."], ["Built things."]]);
    expectRelativeKeys(entries, "experience");
  });

  it("drops the heading when it holds two jobs", () => {
    const entries = parseBlockAs(
      "experience",
      "Engineer\nAcme | 2020 - 2021\n- Did it.\n\nAnalyst\nGlobex | 2018 - 2019\n- Did that.",
      "OTHER WORK",
    );
    expect(entries).toHaveLength(2);
    expect(JSON.stringify(entries)).not.toContain("OTHER WORK");
  });
});

describe("parseBlockAs: education", () => {
  it("parses a degree and keys it relative to the block", () => {
    const entries = parseBlockAs("education", "BSc Computer Science\nState University | 2015 - 2019");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.value.school).toBe("State University");
    expectRelativeKeys(entries, "education");
  });
});

describe("parseBlockAs: skills", () => {
  it("reads a labelled line as one categorised group", () => {
    const entries = parseBlockAs("skills", "Languages: Go, Python");
    expect(entries).toEqual([
      { value: { category: "Languages", items: ["Go", "Python"] }, confidence: { "skills.0.items": 0.9 } },
    ]);
  });

  it("reads several labelled lines as several groups, each with its own keys", () => {
    const entries = parseBlockAs("skills", "Languages: Go, Python\nCloud: AWS, GCP");
    expect(entries.map((entry) => entry.value.category)).toEqual(["Languages", "Cloud"]);
    expectRelativeKeys(entries, "skills");
    expect(entries[1]!.confidence).toEqual({ "skills.1.items": 0.9 });
  });

  it("keeps the flat-list flag under the threshold", () => {
    const entries = parseBlockAs("skills", "Go, Python, TypeScript");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.value.category).toBeUndefined();
    expect(entries[0]!.confidence["skills.0.items"]).toBe(0.5);
  });

  it("ignores a heading: a skills block has no entry to name", () => {
    const entries = parseBlockAs("skills", "Languages: Go, Python", "TECHNICAL");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.value.category).toBe("Languages");
  });
});

describe("parseBlockAs: certifications", () => {
  it("splits two pipe-separated certifications on one line into two entries", () => {
    const entries = parseBlockAs(
      "certifications",
      "CompTIA Security+ | AWS Certified Security – Specialty",
    );

    expect(entries).toHaveLength(2);
    expect(entries[0]!.value).toEqual({ name: "CompTIA Security+", issuer: "CompTIA" });
    expect(entries[1]!.value).toEqual({ name: "AWS Certified Security – Specialty", issuer: "AWS" });
    expectRelativeKeys(entries, "certifications");
  });

  it("numbers entries continuously across lines", () => {
    const entries = parseBlockAs(
      "certifications",
      "CompTIA Security+ | CompTIA CySA+\n\nAWS Certified Solutions Architect, Amazon, 2022",
    );
    expect(entries).toHaveLength(3);
    expect(entries[2]!.value).toEqual({
      name: "AWS Certified Solutions Architect",
      issuer: "Amazon",
      date: "2022",
    });
    expectRelativeKeys(entries, "certifications");
  });

  it("ignores a heading: certifications are one per line, never named by it", () => {
    const entries = parseBlockAs("certifications", "CompTIA Security+", "CERTS");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.value.name).toBe("CompTIA Security+");
  });
});

describe("parseBlockAs: nothing to parse", () => {
  it("returns no entries for empty text", () => {
    expect(parseBlockAs("projects", "")).toEqual([]);
    expect(parseBlockAs("experience", "")).toEqual([]);
    expect(parseBlockAs("education", "")).toEqual([]);
    expect(parseBlockAs("skills", "")).toEqual([]);
    expect(parseBlockAs("certifications", "")).toEqual([]);
  });

  it("treats whitespace-only text as empty, heading or not", () => {
    expect(parseBlockAs("projects", "  \n\n\t ", "VIGIL")).toEqual([]);
    expect(parseBlockAs("certifications", "\n\n")).toEqual([]);
  });

describe("parseBlockAs with unpunctuated bullets", () => {
  it("does not fold a title between bullet groups into the bullet above", () => {
    const entries = parseBlockAs(
      "projects",
      "Vigil\n- Runtime guard for tool calls\nSentinel\n- Prompt-injection scanner",
    );
    expect(entries.map((entry) => entry.value.name)).toEqual(["Vigil", "Sentinel"]);
  });
});
});
