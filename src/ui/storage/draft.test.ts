import { afterEach, describe, expect, it, vi } from "vitest";
import { parseText } from "../../parse";
import { adopt } from "../review/adopt";
import { initialState, reviewReducer, type ReviewState, type Source } from "../review/state";
import {
  DRAFT_KEY,
  clearDraft,
  parseDraft,
  saveDraft,
  serializeDraft,
} from "./draft";
import { getLocalStorage, safeGet, safeSet, type StorageLike } from "./safeStorage";

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
Go, Python

VOLUNTEER
Helped at the shelter.`;

const SOURCE: Source = { fileName: "jane.txt", format: "text", text: TEXT };
const NOW = "2026-09-22T10:00:00.000Z";

function loaded(): ReviewState {
  const state = adopt(parseText(TEXT), SOURCE);
  return reviewReducer(state, { type: "SET_FIELD", key: "e1.company", value: "Acme" });
}

function envelopeOf(state: ReviewState): Record<string, unknown> {
  return JSON.parse(serializeDraft(state, NOW)) as Record<string, unknown>;
}

/** Map-backed storage. `failing` decides per call what to throw, if anything. */
function stubStorage(failing?: (op: "get" | "set" | "remove", size: number) => unknown): StorageLike & {
  map: Map<string, string>;
} {
  const map = new Map<string, string>();
  const raise = (op: "get" | "set" | "remove", size: number) => {
    const error = failing?.(op, size);
    if (error) throw error;
  };
  return {
    map,
    getItem(k) {
      raise("get", 0);
      return map.get(k) ?? null;
    },
    setItem(k, v) {
      raise("set", v.length);
      map.set(k, v);
    },
    removeItem(k) {
      raise("remove", 0);
      map.delete(k);
    },
  };
}

function quotaError(shape: "name" | "code22" | "code1014" | "geckoName"): Error {
  const error = new Error("full") as Error & { code?: number };
  if (shape === "name") error.name = "QuotaExceededError";
  if (shape === "geckoName") error.name = "NS_ERROR_DOM_QUOTA_REACHED";
  if (shape === "code22") error.code = 22;
  if (shape === "code1014") error.code = 1014;
  return error;
}

/** Throws quota once the write is larger than `limit` characters. */
function quotaStorage(limit: number, shape: Parameters<typeof quotaError>[0] = "name") {
  return stubStorage((op, size) => (op === "set" && size > limit ? quotaError(shape) : undefined));
}

const throwingStorage = () => stubStorage(() => new Error("SecurityError"));

describe("round trip", () => {
  it("restores everything except loadSeq, which is UI-only", () => {
    const state = { ...loaded(), loadSeq: 7, templateId: "minimal" };
    const restored = parseDraft(serializeDraft(state, NOW));
    expect(restored).not.toBeNull();
    expect(restored!.savedAt).toBe(NOW);
    expect(restored!.state).toEqual({ ...state, loadSeq: 0 });
    expect(restored!.state.review["e1.company"]?.resolved).toBe("edited");
    expect(restored!.state.blocks[0]?.heading).toBe("VOLUNTEER");
    expect(restored!.state.source?.text).toBe(TEXT);
  });

  it("restores an empty working name, which the contract alone would reject", () => {
    const restored = parseDraft(serializeDraft(initialState(), NOW));
    expect(restored?.state.resume.basics.name).toBe("");
  });
});

describe("parseDraft refuses", () => {
  it("null and corrupt JSON", () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft("")).toBeNull();
    expect(parseDraft("{not json")).toBeNull();
    expect(parseDraft("42")).toBeNull();
    expect(parseDraft("null")).toBeNull();
  });

  it("a future version and a missing version", () => {
    const future = { ...envelopeOf(loaded()), v: 2 };
    expect(parseDraft(JSON.stringify(future))).toBeNull();
    const { v: _v, ...unversioned } = envelopeOf(loaded());
    expect(parseDraft(JSON.stringify(unversioned))).toBeNull();
  });

  it("a schema failure", () => {
    const broken = { ...envelopeOf(loaded()), nextId: "3" };
    expect(parseDraft(JSON.stringify(broken))).toBeNull();
    const badId = envelopeOf(loaded());
    (badId.entryIds as Record<string, string[]>).experience = ["x1", "e2"];
    expect(parseDraft(JSON.stringify(badId))).toBeNull();
  });

  it("entryIds out of lockstep with the lists", () => {
    const short = envelopeOf(loaded());
    (short.entryIds as Record<string, string[]>).experience = ["e1"];
    expect(parseDraft(JSON.stringify(short))).toBeNull();

    const long = envelopeOf(loaded());
    (long.entryIds as Record<string, string[]>).skills = ["s3", "s4"];
    expect(parseDraft(JSON.stringify(long))).toBeNull();
  });

  it("an id filed under the wrong list, and duplicate ids", () => {
    const wrongList = envelopeOf(loaded());
    (wrongList.entryIds as Record<string, string[]>).experience = ["e1", "d2"];
    expect(parseDraft(JSON.stringify(wrongList))).toBeNull();

    const duplicate = envelopeOf(loaded());
    (duplicate.entryIds as Record<string, string[]>).experience = ["e1", "e1"];
    expect(parseDraft(JSON.stringify(duplicate))).toBeNull();
  });
});

describe("parseDraft repairs", () => {
  it("drops review keys that are malformed or name an absent id", () => {
    const envelope = envelopeOf(loaded());
    const review = envelope.review as Record<string, unknown>;
    review["e99.company"] = { confidence: 0.2, resolved: null };
    review["experience.0.company"] = { confidence: 0.2, resolved: null };
    review["garbage"] = { confidence: 0.2, resolved: null };
    review["basics.title"] = { confidence: 0.4, resolved: "reviewed" };

    const restored = parseDraft(JSON.stringify(envelope));
    expect(restored).not.toBeNull();
    const keys = Object.keys(restored!.state.review);
    expect(keys).not.toContain("e99.company");
    expect(keys).not.toContain("experience.0.company");
    expect(keys).not.toContain("garbage");
    expect(keys).toContain("e1.company");
    expect(restored!.state.review["basics.title"]).toEqual({ confidence: 0.4, resolved: "reviewed" });
  });

  it("bumps nextId above every id in use", () => {
    const envelope = { ...envelopeOf(loaded()), nextId: 1 };
    const restored = parseDraft(JSON.stringify(envelope));
    // Ids run e1, e2, s3 — so the next mint must be 4 even though the
    // envelope claims 1.
    expect(restored!.state.nextId).toBe(4);
  });

  it("leaves a nextId that is already ahead alone", () => {
    const envelope = { ...envelopeOf(loaded()), nextId: 40 };
    expect(parseDraft(JSON.stringify(envelope))!.state.nextId).toBe(40);
  });
});

describe("saveDraft", () => {
  it("writes the full envelope when it fits", () => {
    const storage = stubStorage();
    const state = loaded();
    const result = saveDraft(storage, state, NOW);
    expect(result).toEqual({ ok: true, reduced: false, written: serializeDraft(state, NOW) });
    expect(parseDraft(safeGet(storage, DRAFT_KEY))!.state).toEqual({ ...state, loadSeq: 0 });
  });

  it("retries without source text and blocks on quota", () => {
    const state = loaded();
    const full = serializeDraft(state, NOW).length;
    const storage = quotaStorage(full - 1);

    const result = saveDraft(storage, state, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reduced).toBe(true);
    expect(result.written).toBe(storage.map.get(DRAFT_KEY));

    const restored = parseDraft(result.written)!.state;
    expect(restored.source).toEqual({ ...SOURCE, text: "" });
    expect(restored.blocks).toEqual([]);
    expect(restored.resume).toEqual(state.resume);
    expect(restored.review).toEqual(state.review);
  });

  it("recognises every spelling of quota", () => {
    const state = loaded();
    const full = serializeDraft(state, NOW).length;
    for (const shape of ["name", "code22", "code1014", "geckoName"] as const) {
      const result = saveDraft(quotaStorage(full - 1, shape), state, NOW);
      expect(result.ok && result.reduced, shape).toBe(true);
    }
  });

  it("reports quota when even the reduced envelope does not fit", () => {
    const storage = quotaStorage(0);
    expect(saveDraft(storage, loaded(), NOW)).toEqual({ ok: false, reason: "quota" });
    expect(storage.map.size).toBe(0);
  });

  it("reports unavailable for storage that throws, without retrying", () => {
    let attempts = 0;
    const storage = stubStorage((op) => {
      if (op === "set") attempts += 1;
      return new Error("SecurityError");
    });
    expect(saveDraft(storage, loaded(), NOW)).toEqual({ ok: false, reason: "unavailable" });
    expect(attempts).toBe(1);
  });
});

describe("clearDraft", () => {
  it("removes the key and tolerates storage that throws", () => {
    const storage = stubStorage();
    saveDraft(storage, loaded(), NOW);
    clearDraft(storage);
    expect(storage.map.has(DRAFT_KEY)).toBe(false);
    expect(() => clearDraft(throwingStorage())).not.toThrow();
  });
});

describe("safeStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("safeGet returns null and safeSet reports unavailable when access throws", () => {
    const storage = throwingStorage();
    expect(safeGet(storage, "k")).toBeNull();
    expect(safeSet(storage, "k", "v")).toEqual({ ok: false, reason: "unavailable" });
  });

  it("getLocalStorage is null without a window", () => {
    expect(typeof window).toBe("undefined");
    expect(getLocalStorage()).toBeNull();
  });

  it("getLocalStorage is null when the property access throws", () => {
    vi.stubGlobal("window", {
      get localStorage(): StorageLike {
        throw new Error("SecurityError");
      },
    });
    expect(getLocalStorage()).toBeNull();
  });

  it("getLocalStorage is null when the probe write throws", () => {
    vi.stubGlobal("window", { localStorage: quotaStorage(0) });
    expect(getLocalStorage()).toBeNull();
  });

  it("getLocalStorage returns the storage and leaves no probe key behind", () => {
    const storage = stubStorage();
    vi.stubGlobal("window", { localStorage: storage });
    expect(getLocalStorage()).toBe(storage);
    expect(storage.map.size).toBe(0);
  });
});
