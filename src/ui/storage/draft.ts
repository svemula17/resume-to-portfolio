/**
 * The draft: one key, one versioned envelope.
 *
 * A refresh mid-review must cost nothing — the two-minute clock does not
 * pause for a crashed tab. So the whole ReviewState goes to storage,
 * including the reading-order text (tens of KB; the Source panel has to
 * survive a reload) and the review map (so amber and checkmarks come back).
 * Not stored: undo history, collapsed/touched/focus state, loadSeq.
 *
 * What comes back is never trusted. It went through JSON, it may have been
 * written by an older build, and localStorage is user-editable. Restore is
 * parse → migrate → validate → repair, and nothing on that path throws: a
 * draft that cannot be restored is a one-line notice, not a blank page.
 */
import { z } from "zod";
import { BasicsSchema, ResumeSchema, type Resume } from "../../schema/resume";
import {
  LIST_PATHS,
  idNumber,
  isEntryId,
  isFieldKey,
  parseFieldKey,
  pathOfId,
  ID_PREFIX,
  type BlockId,
  type EntryId,
  type FieldKey,
  type ListPath,
} from "../review/keys";
import { listOf } from "../review/lists";
import type { LeftoverBlock, ReviewRecord, ReviewState, Source } from "../review/state";
import { safeRemove, safeSet, type StorageLike } from "./safeStorage";

/**
 * Unversioned on purpose. The version lives inside the envelope, so a bump
 * migrates in place; a versioned key would leave the old blob orphaned and
 * the user's edits silently gone on the first visit after a deploy.
 */
export const DRAFT_KEY = "rtp.draft";
export const DRAFT_VERSION = 1;

export interface DraftEnvelopeV1 {
  v: 1;
  savedAt: string;
  source: Source | null;
  resume: Resume;
  entryIds: Record<ListPath, EntryId[]>;
  review: Record<string, ReviewRecord>;
  blocks: LeftoverBlock[];
  nextId: number;
  dirty: boolean;
  templateId: string | null;
}

/**
 * The contract minus its one required-ness. The working name may be "" —
 * that is exactly the state the form exists to show — and a draft saved
 * with it must come back rather than fail validation on the way in.
 */
export const DraftResumeSchema = ResumeSchema.extend({
  basics: BasicsSchema.extend({ name: z.string() }),
});

const EntryIdSchema = z.custom<EntryId>((value) => typeof value === "string" && isEntryId(value));
const BlockIdSchema = z.custom<BlockId>((value) => typeof value === "string" && /^b\d+$/.test(value));

const ReviewRecordSchema = z.object({
  confidence: z.number(),
  resolved: z.enum(["edited", "reviewed"]).nullable(),
});

const LeftoverBlockSchema = z.object({
  id: BlockIdSchema,
  heading: z.string(),
  text: z.string(),
  status: z.enum(["open", "used", "dismissed"]),
  importedIds: z.array(EntryIdSchema).optional(),
});

const SourceSchema = z.object({
  fileName: z.string(),
  format: z.enum(["pdf", "docx", "text"]),
  text: z.string(),
});

const EntryIdsSchema = z.object({
  experience: z.array(EntryIdSchema),
  education: z.array(EntryIdSchema),
  projects: z.array(EntryIdSchema),
  skills: z.array(EntryIdSchema),
  certifications: z.array(EntryIdSchema),
  "basics.links": z.array(EntryIdSchema),
});

export const DraftEnvelopeSchema: z.ZodType<DraftEnvelopeV1> = z.object({
  v: z.literal(1),
  savedAt: z.string(),
  source: SourceSchema.nullable(),
  resume: DraftResumeSchema,
  entryIds: EntryIdsSchema,
  review: z.record(z.string(), ReviewRecordSchema),
  blocks: z.array(LeftoverBlockSchema),
  nextId: z.number().int(),
  dirty: z.boolean(),
  templateId: z.string().nullable(),
});

export function serializeDraft(state: ReviewState, savedAt: string): string {
  const envelope: DraftEnvelopeV1 = {
    v: DRAFT_VERSION,
    savedAt,
    source: state.source,
    resume: state.resume,
    entryIds: state.entryIds,
    review: state.review as Record<string, ReviewRecord>,
    blocks: state.blocks,
    nextId: state.nextId,
    dirty: state.dirty,
    templateId: state.templateId,
  };
  return JSON.stringify(envelope);
}

/**
 * One case per version, each upgrading a single step, so a draft from any
 * past build walks forward through every shape it missed. A version this
 * build has never seen — a newer deploy in another tab, a hand edit — is
 * refused rather than guessed at.
 */
function migrate(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return null;
  switch ((raw as { v?: unknown }).v) {
    case 1:
      return raw;
    default:
      return null;
  }
}

/**
 * Validation says the shape is right; repair says the identities agree.
 *
 * Lockstep is refused, not patched: ids that do not line up with entries
 * cannot be re-derived (which entry lost its id?), and a card editing the
 * wrong entry is worse than a lost draft. Everything else is dropped or
 * bumped, because a stale review key or a low counter only costs a flag or
 * an id, never a wrong edit.
 */
function repair(envelope: DraftEnvelopeV1): ReviewState | null {
  let highest = 0;
  for (const path of LIST_PATHS) {
    const ids = envelope.entryIds[path];
    if (ids.length !== listOf(envelope.resume, path).length) return null;
    for (const id of ids) {
      // An id in the wrong list would make pathOfId lie; a duplicate would
      // make indexOfId find the first one every time.
      if (!id.startsWith(ID_PREFIX[path])) return null;
      highest = Math.max(highest, idNumber(id));
    }
    if (new Set(ids).size !== ids.length) return null;
  }

  const review: ReviewState["review"] = {};
  for (const [key, record] of Object.entries(envelope.review)) {
    if (!isFieldKey(key)) continue;
    const target = parseFieldKey(key);
    if (target.scope === "entry" && !envelope.entryIds[pathOfId(target.id)].includes(target.id)) {
      continue;
    }
    review[key as FieldKey] = record;
  }

  return {
    resume: envelope.resume,
    entryIds: envelope.entryIds,
    review,
    blocks: envelope.blocks,
    source: envelope.source,
    nextId: Math.max(envelope.nextId, highest + 1),
    dirty: envelope.dirty,
    templateId: envelope.templateId,
    loadSeq: 0,
  };
}

/** null for anything that cannot be restored; never throws. */
export function parseDraft(raw: string | null): { state: ReviewState; savedAt: string } | null {
  if (raw === null) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const migrated = migrate(json);
  if (migrated === null) return null;
  const result = DraftEnvelopeSchema.safeParse(migrated);
  if (!result.success) return null;
  const state = repair(result.data);
  if (state === null) return null;
  return { state, savedAt: result.data.savedAt };
}

export type SaveResult =
  | { ok: true; reduced: boolean; written: string }
  | { ok: false; reason: "quota" | "unavailable" };

/**
 * On quota, retry once without the two things that are big and
 * recoverable: the reading-order text (upload the file again) and the
 * leftover blocks (they came from that text). The user's edits are neither,
 * and they are what the draft is for.
 */
export function saveDraft(storage: StorageLike, state: ReviewState, now: string): SaveResult {
  const full = serializeDraft(state, now);
  const first = safeSet(storage, DRAFT_KEY, full);
  if (first.ok) return { ok: true, reduced: false, written: full };
  if (first.reason !== "quota") return first;

  const reduced = serializeDraft(
    {
      ...state,
      source: state.source ? { ...state.source, text: "" } : null,
      blocks: [],
    },
    now,
  );
  const second = safeSet(storage, DRAFT_KEY, reduced);
  if (second.ok) return { ok: true, reduced: true, written: reduced };
  return second;
}

export function clearDraft(storage: StorageLike): void {
  safeRemove(storage, DRAFT_KEY);
}
