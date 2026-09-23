import { describe, expect, it } from "vitest";
import { parseText } from "../../parse";
import { HISTORY_CAP, initialHistory, reviewHistoryReducer, type HistoryState } from "./history";
import { initialState, reviewReducer, type Source } from "./state";

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

function loaded(): HistoryState {
  return initialHistory(
    reviewReducer(initialState(), { type: "LOAD_PARSE", result: parseText(TEXT), source: SOURCE }),
  );
}

function company(h: HistoryState): string | undefined {
  return h.present.resume.experience[0]?.company;
}

describe("coalescing", () => {
  it("keeps consecutive keystrokes in one field as one step", () => {
    const start = loaded();
    let h = start;
    for (const value of ["A", "Ac", "Acm", "Acme"]) {
      h = reviewHistoryReducer(h, { type: "SET_FIELD", key: "e1.company", value });
    }

    expect(company(h)).toBe("Acme");
    expect(h.past).toHaveLength(1);
    expect(h.lastEdit).toBe("e1.company");

    const undone = reviewHistoryReducer(h, { type: "UNDO" });
    expect(undone.present).toBe(start.present);
    expect(company(undone)).toBe("Acme Inc.");
  });

  it("seals the step when another field is edited", () => {
    let h = reviewHistoryReducer(loaded(), { type: "SET_FIELD", key: "e1.company", value: "Acme" });
    h = reviewHistoryReducer(h, { type: "SET_FIELD", key: "e1.role", value: "Lead" });
    h = reviewHistoryReducer(h, { type: "SET_FIELD", key: "e1.company", value: "Acme Corp" });

    expect(h.past).toHaveLength(3);
    expect(h.lastEdit).toBe("e1.company");
  });

  it("seals the step when any other action intervenes", () => {
    let h = reviewHistoryReducer(loaded(), { type: "SET_FIELD", key: "e1.company", value: "Acme" });
    h = reviewHistoryReducer(h, { type: "MARK_REVIEWED", key: "s3.items" });
    expect(h.lastEdit).toBeNull();

    h = reviewHistoryReducer(h, { type: "SET_FIELD", key: "e1.company", value: "Acme Corp" });
    expect(h.past).toHaveLength(3);

    h = reviewHistoryReducer(h, { type: "UNDO" });
    expect(company(h)).toBe("Acme");
  });

  it("starts a new step for the same field after an undo", () => {
    let h = reviewHistoryReducer(loaded(), { type: "SET_FIELD", key: "e1.company", value: "Acme" });
    h = reviewHistoryReducer(h, { type: "UNDO" });
    expect(h.lastEdit).toBeNull();

    h = reviewHistoryReducer(h, { type: "SET_FIELD", key: "e1.company", value: "Acme Corp" });
    expect(h.past).toHaveLength(1);
    expect(h.future).toEqual([]);
    expect(company(reviewHistoryReducer(h, { type: "UNDO" }))).toBe("Acme Inc.");
  });
});

describe("no-op actions", () => {
  it("push nothing and return the same history reference", () => {
    const h = loaded();
    expect(reviewHistoryReducer(h, { type: "SET_FIELD", key: "e1.company", value: "Acme Inc." })).toBe(h);
    expect(reviewHistoryReducer(h, { type: "SET_FIELD", key: "e99.company", value: "x" })).toBe(h);
    expect(reviewHistoryReducer(h, { type: "MOVE_ENTRY", id: "e1", delta: -1 })).toBe(h);
    expect(reviewHistoryReducer(h, { type: "REFLAG", key: "e1.company" })).toBe(h);
  });

  it("do not seal an open step", () => {
    let h = reviewHistoryReducer(loaded(), { type: "SET_FIELD", key: "e1.company", value: "Acme" });
    h = reviewHistoryReducer(h, { type: "MOVE_ENTRY", id: "e1", delta: -1 });
    h = reviewHistoryReducer(h, { type: "SET_FIELD", key: "e1.company", value: "Acme Corp" });
    expect(h.past).toHaveLength(1);
  });

  it("UNDO with no past and REDO with no future return the same reference", () => {
    const h = loaded();
    expect(reviewHistoryReducer(h, { type: "UNDO" })).toBe(h);
    expect(reviewHistoryReducer(h, { type: "REDO" })).toBe(h);
  });
});

describe("undo and redo", () => {
  it("round-trip through the same present references", () => {
    const start = loaded();
    const edited = reviewHistoryReducer(start, { type: "SET_FIELD", key: "basics.name", value: "Jane R. Doe" });
    const removed = reviewHistoryReducer(edited, { type: "REMOVE_ENTRY", id: "e2" });
    expect(removed.past).toHaveLength(2);

    const undone = reviewHistoryReducer(removed, { type: "UNDO" });
    expect(undone.present).toBe(edited.present);
    expect(undone.future).toHaveLength(1);

    const undoneTwice = reviewHistoryReducer(undone, { type: "UNDO" });
    expect(undoneTwice.present).toBe(start.present);
    expect(undoneTwice.past).toEqual([]);

    const redone = reviewHistoryReducer(undoneTwice, { type: "REDO" });
    expect(redone.present).toBe(edited.present);
    const redoneTwice = reviewHistoryReducer(redone, { type: "REDO" });
    expect(redoneTwice.present).toBe(removed.present);
    expect(redoneTwice.future).toEqual([]);
    expect(redoneTwice.past).toHaveLength(2);
  });

  it("shares the source text by reference across the stacks", () => {
    const start = loaded();
    const edited = reviewHistoryReducer(start, { type: "SET_FIELD", key: "basics.name", value: "J" });
    expect(edited.present.source).toBe(start.present.source);
    expect(edited.past[0]!.source).toBe(start.present.source);
  });

  it("drops the future when a new action follows an undo", () => {
    let h = reviewHistoryReducer(loaded(), { type: "SET_FIELD", key: "basics.name", value: "Jane R. Doe" });
    h = reviewHistoryReducer(h, { type: "UNDO" });
    expect(h.future).toHaveLength(1);

    h = reviewHistoryReducer(h, { type: "ADD_ENTRY", path: "education" });
    expect(h.future).toEqual([]);
    expect(reviewHistoryReducer(h, { type: "REDO" })).toBe(h);
  });
});

describe("cap", () => {
  it("drops the oldest step past the cap", () => {
    const start = loaded();
    let h = start;
    for (let i = 0; i < HISTORY_CAP + 5; i += 1) {
      h = reviewHistoryReducer(h, { type: "ADD_ENTRY", path: "certifications" });
    }

    expect(h.past).toHaveLength(HISTORY_CAP);
    expect(h.past[0]).not.toBe(start.present);
    expect(h.past[0]!.resume.certifications).toHaveLength(5);
    expect(h.present.resume.certifications).toHaveLength(HISTORY_CAP + 5);
  });
});

describe("wholesale loads", () => {
  function withHistory(): HistoryState {
    let h = reviewHistoryReducer(loaded(), { type: "SET_FIELD", key: "basics.name", value: "Jane R. Doe" });
    h = reviewHistoryReducer(h, { type: "REMOVE_ENTRY", id: "e2" });
    h = reviewHistoryReducer(h, { type: "UNDO" });
    expect(h.past).toHaveLength(1);
    expect(h.future).toHaveLength(1);
    return h;
  }

  it("LOAD_PARSE clears both stacks", () => {
    const h = reviewHistoryReducer(withHistory(), {
      type: "LOAD_PARSE",
      result: parseText("Other Person\nother@example.com"),
      source: SOURCE,
    });
    expect(h.past).toEqual([]);
    expect(h.future).toEqual([]);
    expect(h.lastEdit).toBeNull();
    expect(h.present.resume.basics.name).toBe("Other Person");
    expect(reviewHistoryReducer(h, { type: "UNDO" })).toBe(h);
  });

  it("HYDRATE clears both stacks", () => {
    const before = withHistory();
    const h = reviewHistoryReducer(before, { type: "HYDRATE", state: loaded().present });
    expect(h.past).toEqual([]);
    expect(h.future).toEqual([]);
    expect(h.present.loadSeq).toBe(before.present.loadSeq + 1);
  });

  it("RESET clears both stacks", () => {
    const h = reviewHistoryReducer(withHistory(), { type: "RESET" });
    expect(h.past).toEqual([]);
    expect(h.future).toEqual([]);
    expect(h.present.source).toBeNull();
  });
});
