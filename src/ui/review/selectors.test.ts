import { describe, expect, it } from "vitest";
import { parseText } from "../../parse";
import { adopt } from "./adopt";
import { BASICS_FIELD_NAMES } from "./descriptors";
import type { FieldKey } from "./keys";
import {
  documentKeys,
  entryFlagCount,
  flagCount,
  flagQueue,
  isSeededMissing,
  nextFlagKey,
} from "./selectors";
import { initialState, reviewReducer, type ReviewState, type Source } from "./state";

const SOURCE: Source = { fileName: "jane.txt", format: "text", text: "" };

// Deliberately shaped: the second job has no company line (a seeded
// "Missing" at e2.company) and the skills section is a flat comma list
// (the parser's 0.5). Everything else parses above the threshold, so the
// walk on this resume is exactly two stops in a known order.
const TEXT = `Jane Doe
jane@example.com
github.com/janedoe

EXPERIENCE
Staff Engineer
Acme Inc. | 2021 - Present
- Led things.

Engineer
2018 - 2020
- Built things.

EDUCATION
BSc Computer Science
State University | 2014 - 2018

PROJECTS
Vigil
A watcher. Built with Go, Rust.

SKILLS
Go, Python

CERTIFICATIONS
AWS Solutions Architect - 2022`;

function loaded(): ReviewState {
  return adopt(parseText(TEXT), SOURCE);
}

/** The same state with extra records, for ordering tests that need more stops. */
function flagged(state: ReviewState, keys: FieldKey[], confidence = 0.3): ReviewState {
  const review = { ...state.review };
  for (const key of keys) review[key] = { confidence, resolved: null };
  return { ...state, review };
}

describe("documentKeys", () => {
  it("lists basics in descriptor order with each link's fields after the group key", () => {
    const keys = documentKeys(loaded());
    const basics = BASICS_FIELD_NAMES.map((field) => `basics.${field}`);
    const linksAt = keys.indexOf("basics.links");

    expect(keys.slice(0, linksAt + 1)).toEqual(basics.slice(0, basics.indexOf("basics.links") + 1));
    expect(keys.slice(linksAt, linksAt + 3)).toEqual(["basics.links", "l7.label", "l7.url"]);
    // links is the last basics field, so the first section follows the last link field.
    expect(keys[linksAt + 3]).toBe("e1.role");
  });

  it("walks sections in SECTION_ORDER, entries in array order, fields in descriptor order", () => {
    const keys = documentKeys(loaded());
    const firstOf = (prefix: string) => keys.findIndex((key) => key.startsWith(prefix));

    expect(keys.slice(firstOf("e1."), firstOf("e2."))).toEqual([
      "e1.role",
      "e1.company",
      "e1.location",
      "e1.startDate",
      "e1.endDate",
      "e1.current",
      "e1.bullets",
    ]);
    expect([firstOf("e1."), firstOf("e2."), firstOf("d3."), firstOf("p4."), firstOf("s5."), firstOf("c6.")]).toEqual(
      [...[firstOf("e1."), firstOf("e2."), firstOf("d3."), firstOf("p4."), firstOf("s5."), firstOf("c6.")]].sort(
        (a, b) => a - b,
      ),
    );
    expect(keys.at(-1)).toBe("c6.date");
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("follows the entry arrays, so a move reorders the walk and a remove shortens it", () => {
    const moved = reviewReducer(loaded(), { type: "MOVE_ENTRY", id: "e2", delta: -1 });
    const keys = documentKeys(moved);
    expect(keys.indexOf("e2.role")).toBeLessThan(keys.indexOf("e1.role"));

    const removed = reviewReducer(loaded(), { type: "REMOVE_ENTRY", id: "e1" });
    expect(documentKeys(removed).some((key) => key.startsWith("e1."))).toBe(false);
  });

  it("holds only basics keys for the blank state", () => {
    expect(documentKeys(initialState())).toEqual(BASICS_FIELD_NAMES.map((field) => `basics.${field}`));
  });
});

describe("flagQueue and counts", () => {
  it("is the flagged keys in document order", () => {
    const state = loaded();
    expect(flagQueue(state)).toEqual(["e2.company", "s5.items"]);
    expect(flagCount(state)).toBe(2);
  });

  it("places a low link field and a low basics field where the document does", () => {
    const state = flagged(loaded(), ["basics.title", "l7.url", "basics.links"]);
    expect(flagQueue(state)).toEqual(["basics.title", "basics.links", "l7.url", "e2.company", "s5.items"]);
  });

  it("drops a stop once its record is resolved, either way", () => {
    const reviewed = reviewReducer(loaded(), { type: "MARK_REVIEWED", key: "s5.items" });
    expect(flagQueue(reviewed)).toEqual(["e2.company"]);

    const edited = reviewReducer(reviewed, { type: "SET_FIELD", key: "e2.company", value: "Globex" });
    expect(flagQueue(edited)).toEqual([]);
    expect(flagCount(edited)).toBe(0);

    const reflagged = reviewReducer(edited, { type: "REFLAG", key: "s5.items" });
    expect(flagQueue(reflagged)).toEqual(["s5.items"]);
  });

  it("ignores a confident record", () => {
    const state = loaded();
    expect(state.review["e1.company"]?.confidence).toBe(1);
    expect(flagQueue(state)).not.toContain("e1.company");
  });

  it("entryFlagCount counts one entry's stops and agrees with the queue", () => {
    const state = flagged(loaded(), ["e2.role", "e2.bullets"]);
    expect(entryFlagCount(state, "e2")).toBe(3);
    expect(entryFlagCount(state, "e1")).toBe(0);
    expect(entryFlagCount(state, "s5")).toBe(1);
    expect(entryFlagCount(state, "e99")).toBe(0);

    const total = (["e1", "e2", "d3", "p4", "s5", "c6", "l7"] as const)
      .map((id) => entryFlagCount(state, id))
      .reduce((a, b) => a + b, 0);
    expect(total).toBe(flagCount(state));
  });

  it("entryFlagCount does not count a record no descriptor can reach", () => {
    const state = flagged(loaded(), ["e2.bogus" as FieldKey]);
    expect(entryFlagCount(state, "e2")).toBe(1);
    expect(flagQueue(state)).not.toContain("e2.bogus");
  });
});

describe("nextFlagKey", () => {
  it("starts from the top with a null cursor and from the bottom going backwards", () => {
    const state = loaded();
    expect(nextFlagKey(state, null, 1)).toBe("e2.company");
    expect(nextFlagKey(state, null, -1)).toBe("s5.items");
  });

  it("finds the stop strictly after or before the cursor, whether or not the cursor is flagged", () => {
    const state = loaded();
    expect(nextFlagKey(state, "basics.name", 1)).toBe("e2.company");
    expect(nextFlagKey(state, "e2.company", 1)).toBe("s5.items");
    expect(nextFlagKey(state, "e2.role", 1)).toBe("e2.company");
    expect(nextFlagKey(state, "s5.items", -1)).toBe("e2.company");
    expect(nextFlagKey(state, "c6.name", -1)).toBe("s5.items");
  });

  it("returns null at either end instead of wrapping", () => {
    const state = loaded();
    expect(nextFlagKey(state, "s5.items", 1)).toBeNull();
    expect(nextFlagKey(state, "c6.date", 1)).toBeNull();
    expect(nextFlagKey(state, "e2.company", -1)).toBeNull();
    expect(nextFlagKey(state, "basics.name", -1)).toBeNull();
  });

  it("treats a cursor outside the document as no cursor", () => {
    const state = loaded();
    expect(nextFlagKey(state, "e99.company", 1)).toBe("e2.company");
    expect(nextFlagKey(state, "e99.company", -1)).toBe("s5.items");
  });

  it("returns null when nothing is flagged", () => {
    let state = loaded();
    state = reviewReducer(state, { type: "MARK_REVIEWED", key: "e2.company" });
    state = reviewReducer(state, { type: "MARK_REVIEWED", key: "s5.items" });
    expect(nextFlagKey(state, null, 1)).toBeNull();
    expect(nextFlagKey(state, null, -1)).toBeNull();
  });

  it("walks the document order, not insertion order of the review map", () => {
    // basics.title is added to the map last but sits first in the document.
    const state = flagged(loaded(), ["basics.title"]);
    expect(nextFlagKey(state, null, 1)).toBe("basics.title");
    expect(nextFlagKey(state, "basics.title", 1)).toBe("e2.company");
  });
});

describe("isSeededMissing", () => {
  it("is true for a seeded core field that is still empty", () => {
    const state = loaded();
    expect(state.review["e2.company"]).toEqual({ confidence: 0, resolved: null });
    expect(isSeededMissing(state, "e2.company")).toBe(true);
  });

  it("is true for the name the parser scored 0 and adopt blanked", () => {
    const state = adopt(parseText("!!!"), SOURCE);
    expect(state.resume.basics.name).toBe("");
    expect(isSeededMissing(state, "basics.name")).toBe(true);
  });

  it("is false for parser doubt, an absent record, or a filled-in value", () => {
    const state = loaded();
    expect(isSeededMissing(state, "s5.items")).toBe(false);
    expect(isSeededMissing(state, "e1.location")).toBe(false);

    const typed = reviewReducer(state, { type: "SET_FIELD", key: "e2.company", value: "Globex" });
    expect(isSeededMissing(typed, "e2.company")).toBe(false);
  });

  it("tracks the live value: an erased company is missing again, but not a stop", () => {
    // The check is on the value, not a stored kind: erasing a typed company
    // makes the field "missing" again even though the record reads edited.
    // The chip composes this with isFlagged, so it does not become a stop.
    let state = reviewReducer(loaded(), { type: "SET_FIELD", key: "e2.company", value: "Globex" });
    state = reviewReducer(state, { type: "SET_FIELD", key: "e2.company", value: "" });
    expect(isSeededMissing(state, "e2.company")).toBe(true);
    expect(flagQueue(state)).not.toContain("e2.company");
  });

  it("is false for a key whose entry no longer exists", () => {
    const state = loaded();
    const orphaned = { ...state, review: { ...state.review, "e99.company": { confidence: 0, resolved: null } } };
    expect(isSeededMissing(orphaned, "e99.company")).toBe(false);
  });
});
