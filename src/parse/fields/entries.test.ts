import { describe, expect, it } from "vitest";
import { linesFromText } from "../from-text";
import { parseEducationEntry } from "./education";
import { parseExperienceEntry } from "./experience";
import { parseCertificationLine, parseProjectEntry } from "./projects";
import { parseSkills, splitSkillItems } from "./skills";

describe("parseExperienceEntry", () => {
  it("separates role, company, location and dates from a two-line heading", () => {
    const entry = parseExperienceEntry(
      linesFromText(`DevSecOps Engineer
Datadog -- United States (Remote) | June 2025 - Present
• Deploy guardrails and controls that contain what AI agents can do.
• Detect and mitigate prompt injection.`),
      0,
    );

    expect(entry.value).toMatchObject({
      role: "DevSecOps Engineer",
      company: "Datadog",
      location: "United States (Remote)",
      startDate: "June 2025",
      current: true,
    });
    expect(entry.value.endDate).toBeUndefined();
    expect(entry.value.bullets).toHaveLength(2);
  });

  it("does not let a bare location beat the company beside it", () => {
    // The first real-resume failure.
    const entry = parseExperienceEntry(
      linesFromText(`Cloud Security Engineer
BrowserStack -- Mumbai, India | Mar 2023 - Feb 2024
• Did cloud things.`),
      1,
    );

    expect(entry.value.company).toBe("BrowserStack");
    expect(entry.value.location).toBe("Mumbai, India");
    expect(entry.value.endDate).toBe("Feb 2024");
    expect(entry.value.current).toBe(false);
  });

  it("handles company-first templates with dates on their own line", () => {
    const entry = parseExperienceEntry(
      linesFromText(`Acme Corporation, Austin, TX
Staff Engineer
Jan 2021 - Present
- Led the migration.`),
      0,
    );

    expect(entry.value.role).toBe("Staff Engineer");
    expect(entry.value.company).toBe("Acme Corporation");
    expect(entry.value.location).toBe("Austin, TX");
  });

  it("keys confidence by entry index so the review form can flag one job", () => {
    const entry = parseExperienceEntry(linesFromText("Engineer\nAcme Inc. | 2020 - 2021"), 3);
    expect(Object.keys(entry.confidence)).toContain("experience.3.role");
    expect(Object.keys(entry.confidence)).toContain("experience.3.company");
  });
});

describe("parseEducationEntry", () => {
  it("parses degree, school, field, dates and GPA", () => {
    const entry = parseEducationEntry(
      linesFromText(`Master of Science in Cybersecurity
Yeshiva University, New York, NY
Expected 2026 | GPA: 3.9/4.0`),
      0,
    );

    expect(entry.value).toMatchObject({
      degree: "Master of Science in Cybersecurity",
      field: "Cybersecurity",
      endDate: "2026",
      gpa: "3.9/4.0",
    });
    expect(entry.value.school).toContain("Yeshiva University");
  });

  it("takes the field after 'in', not after 'of'", () => {
    const entry = parseEducationEntry(linesFromText("Bachelor of Science in Computer Science"), 0);
    expect(entry.value.field).toBe("Computer Science");
  });

  it("only accepts a GPA on a line that says GPA", () => {
    const entry = parseEducationEntry(linesFromText("B.S. Computer Science\nPython 3.9 course"), 0);
    expect(entry.value.gpa).toBeUndefined();
  });
});

describe("splitSkillItems", () => {
  it("expands parenthesised groups into their members", () => {
    expect(splitSkillItems("AWS (IAM, KMS), Terraform")).toEqual(["AWS", "IAM", "KMS", "Terraform"]);
  });

  it("does not split inside a slash-joined pair", () => {
    expect(splitSkillItems("JavaScript/TypeScript, Go")).toEqual(["JavaScript/TypeScript", "Go"]);
  });
});

describe("parseSkills", () => {
  it("reads labelled groups and folds a wrapped list back together", () => {
    const result = parseSkills(
      linesFromText(`Cloud: AWS (IAM, KMS, Secrets
Manager), Terraform
Languages: Go, Python`),
    );

    expect(result.value).toEqual([
      { category: "Cloud", items: ["AWS", "IAM", "KMS", "Secrets Manager", "Terraform"] },
      { category: "Languages", items: ["Go", "Python"] },
    ]);
  });

  it("allows parentheses in a label", () => {
    const result = parseSkills(linesFromText("AI Security (Hands-On): Guardrails, Sandboxes"));
    expect(result.value[0]!.category).toBe("AI Security (Hands-On)");
  });

  it("puts an unlabelled list in one uncategorised group with lower confidence", () => {
    const result = parseSkills(linesFromText("Go, Python, TypeScript"));
    expect(result.value).toEqual([{ items: ["Go", "Python", "TypeScript"] }]);
    expect(result.confidence["skills.0.items"]).toBeLessThan(0.7);
  });
});

describe("parseProjectEntry", () => {
  it("pulls name, tech, url and description apart", () => {
    const entry = parseProjectEntry(
      linesFromText(`Ledger (Go, Postgres) - github.com/janedoe/ledger
An append-only double-entry ledger with a REST API.`),
      0,
    );

    expect(entry.value).toEqual({
      name: "Ledger",
      description: "An append-only double-entry ledger with a REST API.",
      tech: ["Go", "Postgres"],
      url: "github.com/janedoe/ledger",
    });
  });

  it("reads a Tech: line", () => {
    const entry = parseProjectEntry(linesFromText("Vigil\nTech: Python, LangGraph"), 0);
    expect(entry.value.tech).toEqual(["Python", "LangGraph"]);
  });
});

describe("parseCertificationLine", () => {
  it("splits a pipe-separated line into one certification each", () => {
    const parsed = parseCertificationLine(
      "CompTIA Security+ (Active) | CompTIA CySA+ (In Progress) | AWS Certified Security - Specialty",
      0,
    );

    expect(parsed.map((entry) => entry.value)).toEqual([
      { name: "CompTIA Security+ (Active)", issuer: "CompTIA", date: undefined },
      { name: "CompTIA CySA+ (In Progress)", issuer: "CompTIA", date: undefined },
      { name: "AWS Certified Security - Specialty", issuer: "AWS", date: undefined },
    ]);
  });

  it("keeps 'Name, Issuer, Year' as one certification", () => {
    const parsed = parseCertificationLine(
      "AWS Certified Solutions Architect – Associate, Amazon, 2022",
      0,
    );

    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.value).toEqual({
      name: "AWS Certified Solutions Architect – Associate",
      issuer: "Amazon",
      date: "2022",
    });
  });

  it("numbers entries from the supplied start index", () => {
    const parsed = parseCertificationLine("A+ | Network+", 4);
    expect(Object.keys(parsed[1]!.confidence)[0]).toMatch(/^certifications\.5\./);
  });
});
