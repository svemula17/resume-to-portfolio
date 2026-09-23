import { describe, expect, it } from "vitest";
import { splitIntoEntries, splitWhere } from "./subsections";
import type { Line } from "../layout";

function line(text: string, y: number): Line {
  return {
    items: [
      { str: text, x: 72, y, width: text.length * 5.5, height: 11, fontName: "f", bold: false },
    ],
    y,
    height: 11,
    isBold: false,
    x: 72,
    right: 72 + text.length * 5.5,
    text,
  };
}

describe("splitIntoEntries", () => {
  it("splits two jobs separated by a larger gap", () => {
    const lines = [
      line("DevSecOps Engineer", 100),
      line("Datadog | June 2025 - Present", 114),
      line("• Built guardrails", 128),
      line("Cloud Security Engineer", 156), // 28pt gap: twice the typical 14
      line("BrowserStack | Mar 2023 - Feb 2024", 170),
      line("• Ran security reviews", 184),
    ];

    const entries = splitIntoEntries(lines);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.map((l) => l.text)).toEqual([
      "DevSecOps Engineer",
      "Datadog | June 2025 - Present",
      "• Built guardrails",
    ]);
  });

  it("keeps airy bullets attached to the entry above them", () => {
    // The failure this guard exists for: a template with real space between
    // bullets would otherwise shatter one job into four entries.
    const lines = [
      line("DevSecOps Engineer", 100),
      line("Datadog | June 2025 - Present", 114),
      line("• Built guardrails", 142),
      line("• Ran reviews", 170),
      line("• Shipped tooling", 198),
    ];

    expect(splitIntoEntries(lines)).toHaveLength(1);
  });

  it("uses the median so one tall spacer cannot hide every boundary", () => {
    const lines = [
      line("Job A", 100),
      line("Acme", 114),
      line("Job B", 142),
      line("Globex", 156),
      line("Job C", 400), // an enormous gap, e.g. a page break
      line("Initech", 414),
    ];

    expect(splitIntoEntries(lines)).toHaveLength(3);
  });

  it("returns one entry when leading is perfectly uniform", () => {
    // The DOCX path, where y is synthetic and every gap is identical.
    const lines = ["a", "b", "c", "d"].map((t, i) => line(t, 14 + i * 14));
    expect(splitIntoEntries(lines)).toHaveLength(1);
  });

  it("handles empty and single-line sections", () => {
    expect(splitIntoEntries([])).toEqual([]);
    expect(splitIntoEntries([line("only", 100)])).toHaveLength(1);
  });
});

describe("splitWhere", () => {
  it("splits on a caller-supplied signal instead of whitespace", () => {
    const lines = [
      line("Engineer", 14),
      line("Acme | 2020 - 2022", 28),
      line("• did things", 42),
      line("Analyst", 56),
      line("Globex | 2018 - 2020", 70),
    ];

    const entries = splitWhere(lines, (l) => /\| \d{4} - \d{4}/.test(l.text) === false && /^[A-Z][a-z]+$/.test(l.text));
    expect(entries).toHaveLength(2);
    expect(entries[1]![0]!.text).toBe("Analyst");
  });

  it("never starts an entry on a bullet", () => {
    const lines = [line("Engineer", 14), line("• always attached", 28)];
    expect(splitWhere(lines, () => true)).toHaveLength(1);
  });
});
