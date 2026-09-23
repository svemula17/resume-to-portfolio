/**
 * The review form's state and its reducer.
 *
 * Pure, exhaustively switched, and free of Date, Math.random and the DOM —
 * StrictMode invokes reducers twice in development and anything impure
 * shows up as ids that skip or timestamps that disagree.
 *
 * Two invariants the reducer keeps and a dev assertion enforces:
 *   - entryIds[path] is always exactly as long as listOf(resume, path).
 *   - review records are only ever created by adopt/import, resolved by
 *     edit/review, and deleted by REMOVE_ENTRY. Nothing rewrites a key.
 */
import type { ParseResult, Resume } from "../../schema/resume";
import { emptyResume } from "../../schema/resume";
import { adopt, importEntries } from "./adopt";
import type { ImportedEntry } from "./blocks";
import { SECTIONS } from "./descriptors";
import {
  LIST_PATHS,
  entryId,
  parseFieldKey,
  pathOfId,
  type BlockId,
  type EntryId,
  type FieldKey,
  type ListPath,
} from "./keys";
import {
  listOf,
  readBasicsField,
  readField,
  setBasicsField,
  setEntryField,
  withList,
  type FieldValue,
  type ItemOf,
  type ListOf,
} from "./lists";

export type { FieldValue } from "./lists";

export interface ReviewRecord {
  /** The parser's number, kept after resolution so a tooltip can still show it. */
  confidence: number;
  /** null = still flagged (if confidence is low). */
  resolved: "edited" | "reviewed" | null;
}

export interface LeftoverBlock {
  id: BlockId;
  heading: string;
  /** Lines joined with "\n"; "" lines are paragraph breaks. */
  text: string;
  status: "open" | "used" | "dismissed";
  /** Entries an Add to ▾ on this block created, so the import can be reverted. */
  importedIds?: EntryId[];
}

export interface Source {
  fileName: string;
  format: "pdf" | "docx" | "text";
  /** The full reading-order text, for the Source panel. */
  text: string;
}

export interface ReviewState {
  /** Always the contract's shape. Working strings may be "" (see export.ts). */
  resume: Resume;
  /** Parallel to each list, kept in lockstep by the reducer. */
  entryIds: Record<ListPath, EntryId[]>;
  /** Parser doubt and parser silence, one map, keyed by identity. */
  review: Partial<Record<FieldKey, ReviewRecord>>;
  blocks: LeftoverBlock[];
  /** null = nothing loaded: the upload screen. */
  source: Source | null;
  /** The only id source; persisted. */
  nextId: number;
  /** Any edit since load; gates the replace-draft confirm. */
  dirty: boolean;
  /** Stage 4 hook. Choosing a template is not an edit. */
  templateId: string | null;
  /** Bumps on every wholesale load so the form remounts with fresh UI state. */
  loadSeq: number;
}

export type Action =
  | { type: "LOAD_PARSE"; result: ParseResult; source: Source }
  | { type: "HYDRATE"; state: ReviewState }
  | { type: "RESET" }
  | { type: "SET_FIELD"; key: FieldKey; value: FieldValue }
  | { type: "ADD_ENTRY"; path: ListPath; after?: EntryId }
  | { type: "REMOVE_ENTRY"; id: EntryId }
  | { type: "MOVE_ENTRY"; id: EntryId; delta: -1 | 1 }
  | { type: "MARK_REVIEWED"; key: FieldKey }
  | { type: "MARK_ENTRY_REVIEWED"; id: EntryId }
  | { type: "REFLAG"; key: FieldKey }
  | ImportAction
  | { type: "APPEND_SUMMARY"; text: string; blockId?: BlockId }
  | { type: "REVERT_IMPORT"; blockId: BlockId }
  | { type: "DISMISS_BLOCK"; blockId: BlockId }
  | { type: "RESTORE_BLOCK"; blockId: BlockId }
  | { type: "SET_TEMPLATE"; templateId: string | null };

/** Distributive over P so `entries` is typed for the target list. */
export type ImportAction = {
  [P in ListPath]: { type: "IMPORT_ENTRIES"; path: P; entries: ImportedEntry<P>[]; blockId?: BlockId };
}[ListPath];

export function emptyEntryIds(): Record<ListPath, EntryId[]> {
  return {
    experience: [],
    education: [],
    projects: [],
    skills: [],
    certifications: [],
    "basics.links": [],
  };
}

export function initialState(): ReviewState {
  const resume = emptyResume();
  resume.basics.name = "";
  return {
    resume,
    entryIds: emptyEntryIds(),
    review: {},
    blocks: [],
    source: null,
    nextId: 1,
    dirty: false,
    templateId: null,
    loadSeq: 0,
  };
}

/** The id the next ADD_ENTRY on this path will mint, so the UI can focus it. */
export function peekEntryId(state: ReviewState, path: ListPath): EntryId {
  return entryId(path, state.nextId);
}

export function indexOfId(state: ReviewState, id: EntryId): { path: ListPath; index: number } | null {
  const path = pathOfId(id);
  const index = state.entryIds[path].indexOf(id);
  return index < 0 ? null : { path, index };
}

/** Delete every review record belonging to an entry. */
function withoutRecordsOf(review: ReviewState["review"], id: EntryId): ReviewState["review"] {
  const prefix = `${id}.`;
  const next: ReviewState["review"] = {};
  for (const [key, record] of Object.entries(review) as Array<[FieldKey, ReviewRecord]>) {
    if (!key.startsWith(prefix)) next[key] = record;
  }
  return next;
}

function resolveRecord(
  review: ReviewState["review"],
  key: FieldKey,
  resolved: "edited" | "reviewed",
): ReviewState["review"] {
  const record = review[key];
  if (!record || record.resolved !== null) return review;
  return { ...review, [key]: { ...record, resolved } };
}

function setBlockStatus(
  blocks: LeftoverBlock[],
  blockId: BlockId | undefined,
  status: LeftoverBlock["status"],
  importedIds?: EntryId[],
): LeftoverBlock[] {
  if (!blockId) return blocks;
  return blocks.map((block) =>
    block.id === blockId
      ? { ...block, status, ...(importedIds !== undefined ? { importedIds } : {}) }
      : block,
  );
}

/** Splice a list and its ids together — the only way the two ever change. */
export function spliceBoth<P extends ListPath>(
  state: ReviewState,
  path: P,
  index: number,
  deleteCount: number,
  insert: Array<{ id: EntryId; value: ItemOf<P> }>,
): ReviewState {
  const list = [...listOf(state.resume, path)] as ListOf<P>;
  const ids = [...state.entryIds[path]];
  (list as ItemOf<P>[]).splice(index, deleteCount, ...insert.map((entry) => entry.value));
  ids.splice(index, deleteCount, ...insert.map((entry) => entry.id));
  return {
    ...state,
    resume: withList(state.resume, path, list),
    entryIds: { ...state.entryIds, [path]: ids },
  };
}

export function reviewReducer(state: ReviewState, action: Action): ReviewState {
  switch (action.type) {
    case "LOAD_PARSE":
      return { ...adopt(action.result, action.source), loadSeq: state.loadSeq + 1 };

    case "HYDRATE":
      return { ...action.state, loadSeq: state.loadSeq + 1 };

    case "RESET":
      return { ...initialState(), loadSeq: state.loadSeq + 1 };

    case "SET_FIELD": {
      const target = parseFieldKey(action.key);
      let resume: Resume;

      if (target.scope === "basics") {
        if (readBasicsField(state.resume, target.field) === action.value) return state;
        resume = setBasicsField(state.resume, target.field, action.value);
      } else {
        const located = indexOfId(state, target.id);
        if (!located) return state;
        const list = listOf(state.resume, located.path);
        const entry = list[located.index]!;
        if (readField(entry, target.field) === action.value) return state;
        const next = [...list] as ListOf<typeof located.path>;
        (next as ItemOf<typeof located.path>[])[located.index] = setEntryField(
          entry,
          target.field,
          action.value,
        );
        resume = withList(state.resume, located.path, next);
      }

      return {
        ...state,
        resume,
        review: resolveRecord(state.review, action.key, "edited"),
        dirty: true,
      };
    }

    case "ADD_ENTRY": {
      const id = entryId(action.path, state.nextId);
      const ids = state.entryIds[action.path];
      const afterIndex = action.after ? ids.indexOf(action.after) : -1;
      const index = afterIndex < 0 ? ids.length : afterIndex + 1;
      const value = SECTIONS[action.path].empty();
      return {
        ...spliceBoth(state, action.path, index, 0, [{ id, value }]),
        nextId: state.nextId + 1,
        dirty: true,
      };
    }

    case "REMOVE_ENTRY": {
      const located = indexOfId(state, action.id);
      if (!located) return state;
      return {
        ...spliceBoth(state, located.path, located.index, 1, []),
        review: withoutRecordsOf(state.review, action.id),
        dirty: true,
      };
    }

    case "MOVE_ENTRY": {
      const located = indexOfId(state, action.id);
      if (!located) return state;
      const ids = state.entryIds[located.path];
      const target = located.index + action.delta;
      if (target < 0 || target >= ids.length) return state;

      const list = [...listOf(state.resume, located.path)] as ListOf<typeof located.path>;
      const items = list as ItemOf<typeof located.path>[];
      const nextIds = [...ids];
      [items[located.index], items[target]] = [items[target]!, items[located.index]!];
      [nextIds[located.index], nextIds[target]] = [nextIds[target]!, nextIds[located.index]!];

      return {
        ...state,
        resume: withList(state.resume, located.path, list),
        entryIds: { ...state.entryIds, [located.path]: nextIds },
        dirty: true,
      };
    }

    case "MARK_REVIEWED": {
      const review = resolveRecord(state.review, action.key, "reviewed");
      if (review === state.review) return state;
      return { ...state, review, dirty: true };
    }

    case "MARK_ENTRY_REVIEWED": {
      const prefix = `${action.id}.`;
      let review = state.review;
      for (const key of Object.keys(state.review) as FieldKey[]) {
        if (key.startsWith(prefix)) review = resolveRecord(review, key, "reviewed");
      }
      if (review === state.review) return state;
      return { ...state, review, dirty: true };
    }

    case "REFLAG": {
      const record = state.review[action.key];
      // "edited" is terminal: a typed value is the user's answer, and
      // un-resolving it would flag their own text as suspect.
      if (!record || record.resolved !== "reviewed") return state;
      return {
        ...state,
        review: { ...state.review, [action.key]: { ...record, resolved: null } },
        dirty: true,
      };
    }

    case "IMPORT_ENTRIES": {
      if (action.entries.length === 0) return state;
      const imported = importEntries(state, action.path, action.entries);
      const importedIds = imported.entryIds[action.path].slice(state.entryIds[action.path].length);
      return {
        ...imported,
        blocks: setBlockStatus(imported.blocks, action.blockId, "used", importedIds),
        dirty: true,
      };
    }

    case "REVERT_IMPORT": {
      // The inverse of one import, not of whatever happened last. Entries
      // the user has since removed are simply skipped; the block reopens
      // either way.
      const block = state.blocks.find((candidate) => candidate.id === action.blockId);
      if (!block || block.status !== "used") return state;
      let next = state;
      for (const id of block.importedIds ?? []) {
        next = reviewReducer(next, { type: "REMOVE_ENTRY", id });
      }
      return {
        ...next,
        blocks: setBlockStatus(next.blocks, action.blockId, "open", []),
        dirty: true,
      };
    }

    case "APPEND_SUMMARY": {
      const addition = action.text.replace(/\s+/g, " ").trim();
      if (addition === "") return state;
      const summary = [state.resume.basics.summary, addition].filter(Boolean).join(" ");
      return {
        ...state,
        resume: { ...state.resume, basics: { ...state.resume.basics, summary } },
        review: resolveRecord(state.review, "basics.summary", "edited"),
        blocks: setBlockStatus(state.blocks, action.blockId, "used"),
        dirty: true,
      };
    }

    case "DISMISS_BLOCK":
      return { ...state, blocks: setBlockStatus(state.blocks, action.blockId, "dismissed"), dirty: true };

    case "RESTORE_BLOCK":
      return { ...state, blocks: setBlockStatus(state.blocks, action.blockId, "open"), dirty: true };

    case "SET_TEMPLATE":
      if (state.templateId === action.templateId) return state;
      return { ...state, templateId: action.templateId };
  }
}

/**
 * The lockstep invariant. Cheap enough to run after every action in
 * development; a violation here is a reducer bug and should throw at the
 * source rather than surface later as a card editing the wrong entry.
 */
export function assertLockstep(state: ReviewState): void {
  for (const path of LIST_PATHS) {
    const list = listOf(state.resume, path);
    const ids = state.entryIds[path];
    if (list.length !== ids.length) {
      throw new Error(
        `entryIds out of lockstep on ${path}: ${ids.length} ids for ${list.length} entries`,
      );
    }
  }
}

export function checkedReducer(state: ReviewState, action: Action): ReviewState {
  const next = reviewReducer(state, action);
  if (import.meta.env.DEV) assertLockstep(next);
  return next;
}
