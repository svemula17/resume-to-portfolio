/**
 * Index paths → identity, once, at load.
 *
 * The parser speaks in "experience.0.company". The form speaks in
 * "e1.company". This module is the translation, and it runs exactly twice
 * in an entry's life: when the resume is first parsed, and when a block is
 * re-parsed and imported. After that no key anywhere contains an index, so
 * a remove is a prefix delete and a reorder touches nothing.
 */
import { CONFIDENCE_REVIEW_THRESHOLD, type ParseResult, type Resume } from "../../schema/resume";
import type { ImportedEntry } from "./blocks";
import { coreFields, BASICS_FIELDS } from "./descriptors";
import {
  LIST_PATHS,
  blockId,
  entryId,
  fieldKey,
  type EntryId,
  type FieldKey,
  type ListPath,
} from "./keys";
import { listOf, readField, type ItemOf } from "./lists";
import type { LeftoverBlock, ReviewRecord, ReviewState, Source } from "./state";
import { emptyEntryIds, spliceBoth } from "./state";

function isEmptyValue(value: unknown): boolean {
  return value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

/**
 * Re-key one parser confidence entry.
 *
 * A key whose prefix is a list path followed by an index becomes
 * `${entryIds[path][index]}.${rest}`. The rule is general: if the parser
 * ever emits "basics.links.0.url", it re-keys to "l1.url" with no change
 * here. Keys pointing past an array are dropped rather than guessed.
 */
function rekey(key: string, entryIds: Record<ListPath, EntryId[]>): FieldKey | null {
  // Longest path first so "basics.links" wins over a hypothetical "basics".
  const paths = [...LIST_PATHS].sort((a, b) => b.length - a.length);
  for (const path of paths) {
    if (!key.startsWith(`${path}.`)) continue;
    const rest = key.slice(path.length + 1);
    const match = /^(\d+)\.(.+)$/.exec(rest);
    if (!match) {
      // "basics.links" with no index is the group-level key; keep as-is.
      return key === path && path.startsWith("basics.") ? (key as FieldKey) : null;
    }
    const id = entryIds[path][Number(match[1])];
    return id ? fieldKey(id, match[2]!) : null;
  }
  if (key.startsWith("basics.")) return key as FieldKey;
  return null;
}

/** A record for every core field the parser said nothing about. */
function seedCores(
  review: Partial<Record<FieldKey, ReviewRecord>>,
  path: ListPath,
  id: EntryId,
  entry: ItemOf<ListPath>,
): void {
  for (const field of coreFields(path)) {
    const key = fieldKey(id, field);
    if (review[key]) continue;
    if (isEmptyValue(readField(entry, field))) review[key] = { confidence: 0, resolved: null };
  }
}

export function adopt(result: ParseResult, source: Source): ReviewState {
  const resume: Resume = structuredClone(result.data);
  const entryIds = emptyEntryIds();
  let nextId = 1;

  for (const path of LIST_PATHS) {
    entryIds[path] = listOf(resume, path).map(() => {
      const id = entryId(path, nextId);
      nextId += 1;
      return id;
    });
  }

  const review: Partial<Record<FieldKey, ReviewRecord>> = {};
  for (const [key, confidence] of Object.entries(result.confidence)) {
    const rekeyed = rekey(key, entryIds);
    if (rekeyed) review[rekeyed] = { confidence, resolved: null };
  }

  for (const path of LIST_PATHS) {
    const list = listOf(resume, path);
    entryIds[path].forEach((id, index) => seedCores(review, path, id, list[index]!));
  }

  // The parser substitutes "Unknown" for a missing name so its own output
  // validates. The form shows an empty required field instead of a
  // portfolio titled Unknown.
  if (resume.basics.name === "Unknown" && (review["basics.name"]?.confidence ?? 1) === 0) {
    resume.basics.name = "";
  }
  for (const field of Object.keys(BASICS_FIELDS)) {
    const descriptor = BASICS_FIELDS[field as keyof typeof BASICS_FIELDS];
    if (!("core" in descriptor)) continue;
    const key = fieldKey("basics", field);
    if (!review[key] && isEmptyValue(resume.basics[field as keyof typeof resume.basics])) {
      review[key] = { confidence: 0, resolved: null };
    }
  }

  const blocks: LeftoverBlock[] = result.leftover.map((section, index) => ({
    id: blockId(index + 1),
    heading: section.heading,
    text: section.lines.join("\n"),
    status: "open",
  }));

  return {
    resume,
    entryIds,
    review,
    blocks,
    source,
    nextId,
    dirty: false,
    templateId: null,
    loadSeq: 0,
  };
}

/**
 * Append re-parsed entries, flagged exactly as a first parse would flag
 * them: the field parser's confidence re-keyed onto the minted ids, plus
 * seeded cores. An imported entry the parser was unsure about deserves the
 * same amber the original would have had.
 */
export function importEntries<P extends ListPath>(
  state: ReviewState,
  path: P,
  entries: ImportedEntry<P>[],
): ReviewState {
  let nextId = state.nextId;
  const insert = entries.map((entry) => {
    const id = entryId(path, nextId);
    nextId += 1;
    return { id, value: entry.value };
  });

  const index = state.entryIds[path].length;
  const next = spliceBoth(state, path, index, 0, insert);
  const review = { ...next.review };

  entries.forEach((entry, i) => {
    const id = insert[i]!.id;
    for (const [key, confidence] of Object.entries(entry.confidence)) {
      const match = new RegExp(`^${path.replace(".", "\\.")}\\.\\d+\\.(.+)$`).exec(key);
      if (match) review[fieldKey(id, match[1]!)] = { confidence, resolved: null };
    }
    seedCores(review, path, id, entry.value);
  });

  return { ...next, review, nextId };
}

export function isFlagged(record: ReviewRecord | undefined): boolean {
  return record !== undefined && record.confidence < CONFIDENCE_REVIEW_THRESHOLD && record.resolved === null;
}
