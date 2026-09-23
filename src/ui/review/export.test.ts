import { describe, expect, it } from "vitest";
import { ResumeSchema, emptyResume, type Resume } from "../../schema/resume";
import { issueKey, issues, normalise, toResumeJson } from "./export";
import type { EntryId, ListPath } from "./keys";
import { emptyEntryIds, initialState, type ReviewState } from "./state";

/** A working-state resume with every kind of mess the form can hold. */
function messy(): Resume {
  return {
    basics: {
      name: "  Jane Doe ",
      title: "  Staff Engineer  ",
      summary: "",
      email: "jane@example.com",
      phone: "   ",
      location: undefined,
      links: [
        { label: " GitHub ", url: " https://github.com/jane " },
        { label: "Empty", url: "   " },
        { url: "" },
        { label: "", url: "https://jane.dev" },
      ],
    },
    experience: [
      {
        role: " Engineer ",
        company: "Acme",
        startDate: "2021",
        endDate: "2023",
        current: true,
        location: "",
        bullets: [" Led things. ", "", "   ", "Built things."],
      },
      {
        role: "Intern",
        company: "Globex",
        startDate: "2018",
        endDate: " 2020 ",
        current: false,
        bullets: [],
      },
    ],
    education: [{ school: " MIT ", degree: "", gpa: "  " }],
    projects: [{ name: "Vigil", description: " Watches things. ", tech: ["Go", " ", "", " Rust "], url: "" }],
    skills: [{ category: "", items: ["Go", "Python", ""] }],
    certifications: [{ name: " AWS SAA ", issuer: "", date: "2022" }],
  };
}

function stateWith(resume: Resume): ReviewState {
  return { ...initialState(), resume };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe("normalise", () => {
  it("trims every string", () => {
    const out = normalise(messy());
    expect(out.basics.name).toBe("Jane Doe");
    expect(out.basics.title).toBe("Staff Engineer");
    expect(out.experience[0]!.role).toBe("Engineer");
    expect(out.experience[1]!.endDate).toBe("2020");
    expect(out.education[0]!.school).toBe("MIT");
    expect(out.projects[0]!.description).toBe("Watches things.");
    expect(out.certifications[0]!.name).toBe("AWS SAA");
    expect(out.basics.links[0]).toStrictEqual({ label: "GitHub", url: "https://github.com/jane" });
  });

  it("turns empty and blank optionals into absent keys, not undefined values", () => {
    const out = normalise(messy());
    expect("summary" in out.basics).toBe(false);
    expect("phone" in out.basics).toBe(false);
    expect("location" in out.basics).toBe(false);
    expect("location" in out.experience[0]!).toBe(false);
    expect(out.education[0]).toStrictEqual({ school: "MIT" });
    expect(out.skills[0]).toStrictEqual({ items: ["Go", "Python"] });
    expect(out.certifications[0]).toStrictEqual({ name: "AWS SAA", date: "2022" });
  });

  it("drops empty items from bullets, tech and items after trimming", () => {
    const out = normalise(messy());
    expect(out.experience[0]!.bullets).toEqual(["Led things.", "Built things."]);
    expect(out.projects[0]!.tech).toEqual(["Go", "Rust"]);
    expect(out.skills[0]!.items).toEqual(["Go", "Python"]);
  });

  it("drops links whose url is empty after trim and keeps the rest", () => {
    const out = normalise(messy());
    expect(out.basics.links).toStrictEqual([
      { label: "GitHub", url: "https://github.com/jane" },
      { url: "https://jane.dev" },
    ]);
  });

  it("drops endDate when current is true and keeps it otherwise", () => {
    const out = normalise(messy());
    expect("endDate" in out.experience[0]!).toBe(false);
    expect(out.experience[0]!.current).toBe(true);
    expect(out.experience[1]!.endDate).toBe("2020");
    expect(out.experience[1]!.current).toBe(false);

    const unset = normalise({ ...messy(), experience: [{ endDate: "2020", bullets: [] }] });
    expect(unset.experience[0]!.endDate).toBe("2020");
  });

  it("never mutates its input", () => {
    const input = deepFreeze(messy());
    const before = structuredClone(input);
    expect(() => normalise(input)).not.toThrow();
    expect(input).toEqual(before);
  });

  it("always passes ResumeSchema when the name is non-empty", () => {
    for (const resume of [messy(), emptyResume("Jane"), { ...messy(), basics: { name: "J", links: [] } }]) {
      expect(ResumeSchema.safeParse(normalise(resume)).success).toBe(true);
    }
  });

  it("is idempotent", () => {
    const once = normalise(messy());
    expect(normalise(once)).toStrictEqual(once);
  });

  it("throws on the one thing cleaning cannot fix: an empty name", () => {
    expect(() => normalise({ ...messy(), basics: { name: "   ", links: [] } })).toThrow();
  });
});

describe("toResumeJson", () => {
  it("serialises the normalised resume, two-space indented, with a trailing newline", () => {
    const text = toResumeJson(stateWith(messy()));
    expect(text.endsWith("}\n")).toBe(true);
    expect(text.startsWith('{\n  "basics": {')).toBe(true);
    expect(JSON.parse(text)).toStrictEqual(normalise(messy()));
  });

  it("carries no working-state noise into the file", () => {
    const text = toResumeJson(stateWith(messy()));
    expect(text).not.toContain('"summary"');
    expect(text).not.toContain('"Empty"');
    expect(text).not.toContain('"2023"');
  });
});

describe("issues", () => {
  it("reports an empty name on basics.name", () => {
    const state = stateWith({ ...messy(), basics: { name: "", links: [] } });
    expect(issues(state)).toEqual([{ key: "basics.name", message: "A name is required" }]);
  });

  it("treats a whitespace-only name as empty", () => {
    const state = stateWith({ ...messy(), basics: { name: "  \t ", links: [] } });
    expect(issues(state).map((issue) => issue.key)).toEqual(["basics.name"]);
  });

  it("returns nothing for a messy but nameable resume", () => {
    expect(issues(stateWith(messy()))).toEqual([]);
  });

  it("does not report url-less links, because normalise drops them", () => {
    const state = stateWith({
      ...messy(),
      basics: { name: "Jane", links: [{ url: "" }, { label: "x", url: "  " }] },
    });
    expect(issues(state)).toEqual([]);
  });

  it("starts empty for the blank initial state only once a name is typed", () => {
    expect(issues(initialState()).map((issue) => issue.key)).toEqual(["basics.name"]);
    const named = { ...initialState(), resume: { ...initialState().resume, basics: { name: "J", links: [] } } };
    expect(issues(named)).toEqual([]);
  });
});

describe("issueKey", () => {
  const ids: Record<ListPath, EntryId[]> = {
    ...emptyEntryIds(),
    experience: ["e4", "e7"],
    projects: ["p2"],
    "basics.links": ["l1", "l9"],
  };

  it("maps basics fields to their own key", () => {
    expect(issueKey(["basics", "name"], ids)).toBe("basics.name");
    expect(issueKey(["basics", "email"], ids)).toBe("basics.email");
  });

  it("maps a hypothetical entry-level issue to the entry's id, not its index", () => {
    expect(issueKey(["experience", 1, "company"], ids)).toBe("e7.company");
    expect(issueKey(["experience", 0, "role"], ids)).toBe("e4.role");
    expect(issueKey(["projects", 0, "name"], ids)).toBe("p2.name");
  });

  it("maps a link issue through the basics.links ids", () => {
    expect(issueKey(["basics", "links", 1, "url"], ids)).toBe("l9.url");
    expect(issueKey(["basics", "links", 0, "label"], ids)).toBe("l1.label");
  });

  it("lands an issue on a whole entry on that entry's first field", () => {
    expect(issueKey(["experience", 0], ids)).toBe("e4.role");
    expect(issueKey(["basics", "links", 1], ids)).toBe("l9.label");
  });

  it("never drops an issue: anything unplaceable lands on basics.name", () => {
    expect(issueKey([], ids)).toBe("basics.name");
    expect(issueKey(["basics"], ids)).toBe("basics.name");
    expect(issueKey(["experience"], ids)).toBe("basics.name");
    expect(issueKey(["experience", 5, "company"], ids)).toBe("basics.name");
    expect(issueKey(["education", 0, "school"], ids)).toBe("basics.name");
  });
});
