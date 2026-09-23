import { describe, expect, it } from "vitest";
import { parseText } from "../../parse";
import { adopt } from "./adopt";
import {
  assertLockstep,
  initialState,
  peekEntryId,
  reviewReducer,
  type ReviewState,
  type Source,
} from "./state";

const SOURCE: Source = { fileName: "jane.txt", format: "text", text: "" };

const TEXT = `Jane Doe
jane@example.com

EXPERIENCE
Staff Engineer
Acme Inc. | 2021 - Present
- Led things.

Engineer
Globex | 2018 - 2020
- Built things.

SKILLS
Go, Python`;

function loaded(): ReviewState {
  return reviewReducer(initialState(), { type: "LOAD_PARSE", result: parseText(TEXT), source: SOURCE });
}

describe("LOAD_PARSE", () => {
  it("adopts a parse with ids in lockstep and bumps loadSeq", () => {
    const state = loaded();
    expect(state.entryIds.experience).toEqual(["e1", "e2"]);
    expect(state.entryIds.skills).toEqual(["s3"]);
    expect(state.resume.experience).toHaveLength(2);
    expect(state.loadSeq).toBe(1);
    expect(state.dirty).toBe(false);
    expect(() => assertLockstep(state)).not.toThrow();
  });

  it("re-keys confidence onto ids", () => {
    const state = loaded();
    expect(state.review["e1.company"]).toBeDefined();
    expect(state.review["s3.items"]?.confidence).toBeLessThan(0.6);
    expect(Object.keys(state.review).some((key) => /\.\d+\./.test(key))).toBe(false);
  });
});

describe("SET_FIELD", () => {
  it("writes an entry field and resolves its record as edited", () => {
    const state = reviewReducer(loaded(), { type: "SET_FIELD", key: "e1.company", value: "Acme" });
    expect(state.resume.experience[0]!.company).toBe("Acme");
    expect(state.review["e1.company"]?.resolved).toBe("edited");
    expect(state.dirty).toBe(true);
  });

  it("writes a basics field", () => {
    const state = reviewReducer(loaded(), { type: "SET_FIELD", key: "basics.name", value: "Jane R. Doe" });
    expect(state.resume.basics.name).toBe("Jane R. Doe");
  });

  it("returns the same reference for an unchanged value or unknown id", () => {
    const before = loaded();
    expect(reviewReducer(before, { type: "SET_FIELD", key: "e1.company", value: "Acme Inc." })).toBe(before);
    expect(reviewReducer(before, { type: "SET_FIELD", key: "e99.company", value: "x" })).toBe(before);
  });
});

describe("ADD_ENTRY", () => {
  it("mints a deterministic id, appends an empty entry, and creates no records", () => {
    const before = loaded();
    const expected = peekEntryId(before, "education");
    const state = reviewReducer(before, { type: "ADD_ENTRY", path: "education" });

    expect(state.entryIds.education).toEqual([expected]);
    expect(state.resume.education).toEqual([{}]);
    expect(state.nextId).toBe(before.nextId + 1);
    expect(Object.keys(state.review).some((key) => key.startsWith(`${expected}.`))).toBe(false);
    expect(() => assertLockstep(state)).not.toThrow();
  });

  it("inserts after a given entry", () => {
    const state = reviewReducer(loaded(), { type: "ADD_ENTRY", path: "experience", after: "e1" });
    expect(state.entryIds.experience).toEqual(["e1", "e4", "e2"]);
    expect(state.resume.experience[1]).toEqual({ bullets: [] });
  });
});

describe("REMOVE_ENTRY", () => {
  it("splices both arrays and prunes records by prefix", () => {
    const state = reviewReducer(loaded(), { type: "REMOVE_ENTRY", id: "e1" });
    expect(state.entryIds.experience).toEqual(["e2"]);
    expect(state.resume.experience[0]!.company).toBe("Globex");
    expect(Object.keys(state.review).some((key) => key.startsWith("e1."))).toBe(false);
    expect(state.review["e2.company"]).toBeDefined();
    expect(() => assertLockstep(state)).not.toThrow();
  });
});

describe("MOVE_ENTRY", () => {
  it("swaps in both arrays and leaves records alone", () => {
    const before = loaded();
    const state = reviewReducer(before, { type: "MOVE_ENTRY", id: "e2", delta: -1 });
    expect(state.entryIds.experience).toEqual(["e2", "e1"]);
    expect(state.resume.experience[0]!.company).toBe("Globex");
    expect(state.review).toBe(before.review);
  });

  it("returns the same reference at the ends", () => {
    const before = loaded();
    expect(reviewReducer(before, { type: "MOVE_ENTRY", id: "e1", delta: -1 })).toBe(before);
    expect(reviewReducer(before, { type: "MOVE_ENTRY", id: "e2", delta: 1 })).toBe(before);
  });
});

describe("review transitions", () => {
  it("MARK_REVIEWED resolves and REFLAG un-resolves, but never clears edited", () => {
    let state = reviewReducer(loaded(), { type: "MARK_REVIEWED", key: "s3.items" });
    expect(state.review["s3.items"]?.resolved).toBe("reviewed");

    state = reviewReducer(state, { type: "REFLAG", key: "s3.items" });
    expect(state.review["s3.items"]?.resolved).toBeNull();

    state = reviewReducer(state, { type: "SET_FIELD", key: "s3.items", value: ["Go"] });
    const edited = reviewReducer(state, { type: "REFLAG", key: "s3.items" });
    expect(edited).toBe(state);
    expect(edited.review["s3.items"]?.resolved).toBe("edited");
  });

  it("MARK_ENTRY_REVIEWED resolves every unresolved record of one entry", () => {
    const state = reviewReducer(loaded(), { type: "MARK_ENTRY_REVIEWED", id: "e1" });
    for (const [key, record] of Object.entries(state.review)) {
      if (key.startsWith("e1.")) expect(record?.resolved).toBe("reviewed");
    }
    expect(state.review["e2.company"]?.resolved).toBeNull();
  });
});

describe("blocks and summary", () => {
  it("APPEND_SUMMARY collapses whitespace and marks the block used", () => {
    const before = { ...loaded(), blocks: [{ id: "b1" as const, heading: "X", text: "y", status: "open" as const }] };
    const state = reviewReducer(before, { type: "APPEND_SUMMARY", text: "  Extra\n  text ", blockId: "b1" });
    expect(state.resume.basics.summary).toBe("Extra text");
    expect(state.blocks[0]!.status).toBe("used");
  });

  it("DISMISS_BLOCK and RESTORE_BLOCK round-trip", () => {
    const before = { ...loaded(), blocks: [{ id: "b1" as const, heading: "X", text: "y", status: "open" as const }] };
    const dismissed = reviewReducer(before, { type: "DISMISS_BLOCK", blockId: "b1" });
    expect(dismissed.blocks[0]!.status).toBe("dismissed");
    expect(reviewReducer(dismissed, { type: "RESTORE_BLOCK", blockId: "b1" }).blocks[0]!.status).toBe("open");
  });
});

describe("SET_TEMPLATE and RESET", () => {
  it("choosing a template is not an edit", () => {
    const state = reviewReducer(loaded(), { type: "SET_TEMPLATE", templateId: "minimal" });
    expect(state.templateId).toBe("minimal");
    expect(state.dirty).toBe(false);
  });

  it("RESET returns to the upload screen with a fresh loadSeq", () => {
    const state = reviewReducer(loaded(), { type: "RESET" });
    expect(state.source).toBeNull();
    expect(state.resume.basics.name).toBe("");
    expect(state.loadSeq).toBe(2);
  });
});

describe("assertLockstep", () => {
  it("throws when an id array drifts from its list", () => {
    const broken: ReviewState = { ...loaded(), entryIds: { ...loaded().entryIds, experience: ["e1"] } };
    expect(() => assertLockstep(broken)).toThrow(/lockstep/);
  });
});

describe("adopt", () => {
  it("turns Unknown into an empty required name and seeds it", () => {
    const state = adopt(parseText("!!!"), SOURCE);
    expect(state.resume.basics.name).toBe("");
    expect(state.review["basics.name"]).toEqual({ confidence: 0, resolved: null });
  });

  it("seeds a Missing record for a job with no company", () => {
    const state = adopt(parseText("Jane Doe\njane@example.com\n\nEXPERIENCE\nEngineer\n2020 - 2021\n- Did it."), SOURCE);
    expect(state.resume.experience[0]!.company).toBeUndefined();
    expect(state.review["e1.company"]).toEqual({ confidence: 0, resolved: null });
  });
});
