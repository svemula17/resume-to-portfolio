import { describe, expect, it } from "vitest";
import { parseText } from "../../parse";
import { emptyResume, type ParseResult, type Resume } from "../../schema/resume";
import { adopt, importEntries, isFlagged } from "./adopt";
import { parseBlockAs } from "./blocks";
import { assertLockstep, type Source } from "./state";

const SOURCE: Source = { fileName: "jane.txt", format: "text", text: "" };

/**
 * A hand-built result with one entry in every list but experience, which
 * has two — enough to see the counter cross every prefix in LIST_PATHS
 * order and to tell "index 1" from "the first entry".
 */
function fixture(overrides: Partial<ParseResult> = {}): ParseResult {
  const data: Resume = {
    ...emptyResume("Jane Doe"),
    basics: {
      name: "Jane Doe",
      title: "Engineer",
      links: [{ label: "GitHub", url: "github.com/jane" }],
    },
    experience: [
      { role: "Staff Engineer", company: "Acme Inc.", bullets: ["Led things."] },
      { role: "Engineer", bullets: [] },
    ],
    education: [{ school: "State U", degree: "BSc" }],
    projects: [{ name: "Ledger", tech: [] }],
    skills: [{ items: ["Go", "Python"] }],
    certifications: [{ name: "CompTIA Security+" }],
  };
  return {
    data,
    confidence: {
      "basics.name": 0.95,
      "basics.title": 0.7,
      "basics.links": 0.9,
      "experience.0.role": 1,
      "experience.0.company": 1,
      "experience.0.bullets": 0.95,
      "experience.1.role": 0.8,
      "education.0.school": 0.9,
      "projects.0.name": 0.7,
      "skills.0.items": 0.5,
      "certifications.0.name": 0.75,
    },
    leftover: [],
    ...overrides,
  };
}

describe("adopt: identity", () => {
  it("mints ids in LIST_PATHS order from 1", () => {
    const state = adopt(fixture(), SOURCE);
    expect(state.entryIds).toEqual({
      experience: ["e1", "e2"],
      education: ["d3"],
      projects: ["p4"],
      skills: ["s5"],
      certifications: ["c6"],
      "basics.links": ["l7"],
    });
    expect(state.nextId).toBe(8);
    expect(() => assertLockstep(state)).not.toThrow();
  });

  it("re-keys every indexed key onto its id and leaves no index behind", () => {
    const state = adopt(fixture(), SOURCE);
    expect(state.review["e1.company"]).toEqual({ confidence: 1, resolved: null });
    expect(state.review["e2.role"]).toEqual({ confidence: 0.8, resolved: null });
    expect(state.review["d3.school"]?.confidence).toBe(0.9);
    expect(state.review["p4.name"]?.confidence).toBe(0.7);
    expect(state.review["s5.items"]?.confidence).toBe(0.5);
    expect(state.review["c6.name"]?.confidence).toBe(0.75);
    expect(Object.keys(state.review).some((key) => /\.\d+\./.test(key))).toBe(false);
  });

  it("keeps basics keys and the basics.links group key as-is", () => {
    const state = adopt(fixture(), SOURCE);
    expect(state.review["basics.title"]).toEqual({ confidence: 0.7, resolved: null });
    expect(state.review["basics.links"]).toEqual({ confidence: 0.9, resolved: null });
  });

  it("re-keys a per-link key the same way as any other list", () => {
    const base = fixture();
    const state = adopt(
      fixture({ confidence: { ...base.confidence, "basics.links.0.url": 0.8 } }),
      SOURCE,
    );
    expect(state.review["l7.url"]).toEqual({ confidence: 0.8, resolved: null });
    expect(state.review["basics.links"]?.confidence).toBe(0.9);
  });

  it("drops a key that points past its array", () => {
    const base = fixture();
    const state = adopt(
      fixture({
        confidence: { ...base.confidence, "experience.7.company": 0.4, "projects.1.name": 0.4 },
      }),
      SOURCE,
    );
    const keys = Object.keys(state.review);
    expect(keys.some((key) => key.startsWith("e8.") || key.startsWith("e9."))).toBe(false);
    expect(keys.some((key) => key.startsWith("p5."))).toBe(false);
    expect(keys.some((key) => /\.\d+\./.test(key))).toBe(false);
  });

  it("does not share structure with the parse result", () => {
    const result = fixture();
    const state = adopt(result, SOURCE);
    expect(state.resume).not.toBe(result.data);
    expect(state.resume.experience).not.toBe(result.data.experience);
    expect(state.resume).toEqual(result.data);
  });
});

describe("adopt: core seeding", () => {
  it("seeds a Missing record for an empty core field the parser was silent on", () => {
    const state = adopt(fixture(), SOURCE);
    // e2 has a role but no company and no parser key for it.
    expect(state.review["e2.company"]).toEqual({ confidence: 0, resolved: null });
    expect(isFlagged(state.review["e2.company"])).toBe(true);
  });

  it("does not seed a core field that has a value", () => {
    const state = adopt(fixture(), SOURCE);
    expect(state.review["e1.company"]?.confidence).toBe(1);
    expect(state.review["d3.school"]?.confidence).toBe(0.9);
    expect(state.review["c6.name"]?.confidence).toBe(0.75);
  });

  it("does not seed a non-core field, however empty", () => {
    const state = adopt(fixture(), SOURCE);
    expect(state.review["e2.location"]).toBeUndefined();
    expect(state.review["e2.startDate"]).toBeUndefined();
    expect(state.review["d3.gpa"]).toBeUndefined();
    expect(state.review["p4.url"]).toBeUndefined();
    expect(state.review["basics.summary"]).toBeUndefined();
  });

  it("leaves a parser-written record alone even when the value is empty", () => {
    const base = fixture();
    const state = adopt(
      fixture({ confidence: { ...base.confidence, "experience.1.company": 0.4 } }),
      SOURCE,
    );
    expect(state.review["e2.company"]).toEqual({ confidence: 0.4, resolved: null });
  });

  it("seeds an empty entry's every core field and nothing else", () => {
    const base = fixture();
    const state = adopt(
      fixture({
        data: { ...base.data, experience: [{ bullets: [] }] },
        confidence: { "basics.name": 0.95 },
      }),
      SOURCE,
    );
    const entryKeys = Object.keys(state.review).filter((key) => key.startsWith("e1."));
    expect(entryKeys.sort()).toEqual(["e1.company", "e1.role"]);
  });
});

describe("adopt: the name", () => {
  it("turns the parser's Unknown placeholder into an empty required field", () => {
    const base = fixture();
    const state = adopt(
      fixture({
        data: { ...base.data, basics: { ...base.data.basics, name: "Unknown" } },
        confidence: { ...base.confidence, "basics.name": 0 },
      }),
      SOURCE,
    );
    expect(state.resume.basics.name).toBe("");
    expect(state.review["basics.name"]).toEqual({ confidence: 0, resolved: null });
  });

  it("keeps a name that genuinely is Unknown when the parser was sure of it", () => {
    const base = fixture();
    const state = adopt(
      fixture({
        data: { ...base.data, basics: { ...base.data.basics, name: "Unknown" } },
        confidence: { ...base.confidence, "basics.name": 0.9 },
      }),
      SOURCE,
    );
    expect(state.resume.basics.name).toBe("Unknown");
    expect(state.review["basics.name"]?.confidence).toBe(0.9);
  });

  it("seeds basics.name when it is empty and the parser wrote nothing", () => {
    const base = fixture();
    const state = adopt(
      fixture({
        data: { ...base.data, basics: { ...base.data.basics, name: "" } },
        confidence: {},
      }),
      SOURCE,
    );
    expect(state.review["basics.name"]).toEqual({ confidence: 0, resolved: null });
  });
});

describe("adopt: leftover blocks", () => {
  it("numbers blocks from b1 and joins lines with newlines, keeping paragraph breaks", () => {
    const state = adopt(
      fixture({
        leftover: [
          { heading: "AWARDS", lines: ["Best hack 2019", "Second best 2020"] },
          { heading: "VOLUNTEER", lines: ["Soup kitchen", "- Served meals.", "", "Food bank"] },
        ],
      }),
      SOURCE,
    );
    expect(state.blocks).toEqual([
      { id: "b1", heading: "AWARDS", text: "Best hack 2019\nSecond best 2020", status: "open" },
      {
        id: "b2",
        heading: "VOLUNTEER",
        text: "Soup kitchen\n- Served meals.\n\nFood bank",
        status: "open",
      },
    ]);
  });

  it("adopts a resume with no leftovers as no blocks", () => {
    expect(adopt(fixture(), SOURCE).blocks).toEqual([]);
  });
});

describe("adopt: load bookkeeping", () => {
  it("starts clean with the given source and no template", () => {
    const state = adopt(fixture(), SOURCE);
    expect(state.source).toBe(SOURCE);
    expect(state.dirty).toBe(false);
    expect(state.templateId).toBeNull();
    expect(state.loadSeq).toBe(0);
  });
});

describe("adopt: from parseText", () => {
  const TEXT = `Jane Doe
jane@example.com
github.com/jane

EXPERIENCE
Staff Engineer
Acme Inc. | 2021 - Present
- Led things.

Engineer
2018 - 2020
- Built things.

PROJECTS
Ledger
Audit tool.

SKILLS
Go, Python

VOLUNTEER
Soup kitchen
- Served meals.

Food bank
- Sorted cans.`;

  it("re-keys the real parser's map with no index left and the links group intact", () => {
    const state = adopt(parseText(TEXT), SOURCE);
    expect(state.entryIds.experience).toEqual(["e1", "e2"]);
    expect(state.entryIds.projects).toEqual(["p3"]);
    expect(state.entryIds.skills).toEqual(["s4"]);
    expect(state.entryIds["basics.links"]).toEqual(["l5"]);
    expect(state.review["basics.links"]).toBeDefined();
    expect(state.review["e1.company"]?.confidence).toBeGreaterThan(0.6);
    expect(state.review["s4.items"]?.confidence).toBe(0.5);
    expect(Object.keys(state.review).some((key) => /\.\d+\./.test(key))).toBe(false);
    expect(() => assertLockstep(state)).not.toThrow();
  });

  it("turns parser silence on a company into a Missing stop", () => {
    const state = adopt(parseText(TEXT), SOURCE);
    expect(state.resume.experience[1]!.company).toBeUndefined();
    expect(state.review["e2.company"]).toEqual({ confidence: 0, resolved: null });
    expect(state.review["e2.role"]?.confidence).toBeGreaterThan(0);
  });

  it("carries the parser's Unknown into an empty name", () => {
    const state = adopt(parseText("!!!"), SOURCE);
    expect(state.resume.basics.name).toBe("");
    expect(state.review["basics.name"]).toEqual({ confidence: 0, resolved: null });
  });

  it("keeps the unparsed section as a block with its paragraph break", () => {
    const state = adopt(parseText(TEXT), SOURCE);
    expect(state.blocks).toEqual([
      {
        id: "b1",
        heading: "VOLUNTEER",
        text: "Soup kitchen\n- Served meals.\n\nFood bank\n- Sorted cans.",
        status: "open",
      },
    ]);
  });
});

describe("importEntries", () => {
  const BLOCK = `Vigil
Runtime guard for LLM tool calls.
Tech: Go, eBPF

Sentinel
Prompt-injection scanner for CI.

Ledger
Audit log viewer. github.com/x/ledger`;

  it("appends with fresh ids and advances the counter", () => {
    const before = adopt(fixture(), SOURCE);
    const entries = parseBlockAs("projects", BLOCK, "AI SECURITY — BUILT & PUBLISHED");
    const state = importEntries(before, "projects", entries);

    expect(state.entryIds.projects).toEqual(["p4", "p8", "p9", "p10"]);
    expect(state.resume.projects.map((p) => p.name)).toEqual(["Ledger", "Vigil", "Sentinel", "Ledger"]);
    expect(state.nextId).toBe(11);
    expect(() => assertLockstep(state)).not.toThrow();
  });

  it("re-keys the entries' relative confidence onto the minted ids", () => {
    const before = adopt(fixture(), SOURCE);
    const entries = parseBlockAs("projects", BLOCK, "AI SECURITY — BUILT & PUBLISHED");
    expect(Object.keys(entries[0]!.confidence)).toContain("projects.0.name");

    const state = importEntries(before, "projects", entries);
    expect(state.review["p8.name"]).toEqual({ confidence: 0.7, resolved: null });
    expect(state.review["p8.tech"]).toEqual({ confidence: 0.8, resolved: null });
    expect(state.review["p10.url"]).toEqual({ confidence: 0.9, resolved: null });
    expect(Object.keys(state.review).some((key) => /\.\d+\./.test(key))).toBe(false);
  });

  it("seeds cores on imported entries exactly like a first parse", () => {
    const before = adopt(fixture(), SOURCE);
    const state = importEntries(before, "experience", [
      { value: { company: "Globex", bullets: ["Built it."] }, confidence: { "experience.0.company": 0.7 } },
    ]);
    expect(state.entryIds.experience).toEqual(["e1", "e2", "e8"]);
    expect(state.review["e8.company"]).toEqual({ confidence: 0.7, resolved: null });
    expect(state.review["e8.role"]).toEqual({ confidence: 0, resolved: null });
    expect(() => assertLockstep(state)).not.toThrow();
  });

  it("leaves existing entries and their records untouched", () => {
    const before = adopt(fixture(), SOURCE);
    const state = importEntries(before, "projects", parseBlockAs("projects", "Sentinel\nA scanner."));
    expect(state.resume.projects[0]).toBe(before.resume.projects[0]);
    expect(state.review["p4.name"]).toEqual(before.review["p4.name"]);
    expect(state.review["e2.company"]).toEqual(before.review["e2.company"]);
    expect(state.resume.experience).toBe(before.resume.experience);
  });

  it("does not mutate the state it was given", () => {
    const before = adopt(fixture(), SOURCE);
    const ids = [...before.entryIds.projects];
    const reviewKeys = Object.keys(before.review);
    importEntries(before, "projects", parseBlockAs("projects", "Sentinel\nA scanner."));
    expect(before.entryIds.projects).toEqual(ids);
    expect(Object.keys(before.review)).toEqual(reviewKeys);
    expect(before.nextId).toBe(8);
  });
});
