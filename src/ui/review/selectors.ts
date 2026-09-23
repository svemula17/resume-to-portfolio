/**
 * Derived views of the review map: what is flagged, in what order, and
 * where the next stop is.
 *
 * Nothing here is stored. The header badge, the walk's queue and each
 * field's chip all read the same `review` map through the same
 * `isFlagged` rule over the same document order, which is the only reason
 * they can never disagree — a stored "flags" list would need to be kept in
 * sync by every action that touches a record, and the first one to forget
 * would leave a badge counting stops the walk cannot reach.
 *
 * Every function is pure over the state it is given. The UI memoises per
 * `present`; a resume has a few hundred field keys at most, so the walk
 * is cheap enough to recompute on each keystroke.
 */
import { isFlagged } from "./adopt";
import { BASICS_FIELD_NAMES, fieldNames } from "./descriptors";
import { SECTION_ORDER, fieldKey, parseFieldKey, pathOfId, type EntryId, type FieldKey } from "./keys";
import { listOf, readBasicsField, readField, type FieldValue } from "./lists";
import { indexOfId, type ReviewState } from "./state";

/**
 * Every field key in the order the form renders it. This is the walk's
 * coordinate system: "next" and "previous" are positions in this array,
 * not in the review map, so a flag the user resolves out of order still
 * sends them to the right neighbour.
 *
 * Links sit inside basics: the group key "basics.links" (the parser's
 * array-level doubt) comes first, then each link's own fields, at the
 * position the `links` descriptor holds in BASICS_FIELDS. That is where the
 * list renders, so the walk's order matches what the eye sees.
 */
export function documentKeys(state: ReviewState): FieldKey[] {
  const keys: FieldKey[] = [];

  for (const field of BASICS_FIELD_NAMES) {
    keys.push(fieldKey("basics", field));
    if (field !== "links") continue;
    for (const id of state.entryIds["basics.links"]) {
      for (const linkField of fieldNames("basics.links")) keys.push(fieldKey(id, linkField));
    }
  }

  for (const path of SECTION_ORDER) {
    const fields = fieldNames(path);
    for (const id of state.entryIds[path]) {
      for (const field of fields) keys.push(fieldKey(id, field));
    }
  }

  return keys;
}

/** The flagged keys in document order — the walk, and the count behind "Review: 7 left". */
export function flagQueue(state: ReviewState): FieldKey[] {
  return documentKeys(state).filter((key) => isFlagged(state.review[key]));
}

export function flagCount(state: ReviewState): number {
  return flagQueue(state).length;
}

/**
 * Flags on one entry, for the card badge. Counted over the entry's
 * descriptor fields rather than over the review map so the badge and the
 * queue agree by construction: a record under a key no descriptor names
 * is unreachable by the walk and must not be counted as a stop.
 */
export function entryFlagCount(state: ReviewState, id: EntryId): number {
  let count = 0;
  for (const field of fieldNames(pathOfId(id))) {
    if (isFlagged(state.review[fieldKey(id, field)])) count += 1;
  }
  return count;
}

/**
 * The next flagged key strictly after (or before) the cursor in document
 * order, or null at the end. No wrapping: reaching the end of the walk is
 * the signal that the review is done, and a queue that silently loops back
 * to the top hides that from a user holding Cmd+Enter.
 *
 * A null cursor, or one the document does not contain (focus on a button,
 * a card header, the Source panel), starts from the corresponding edge:
 * forward from the top, backward from the bottom. That is what makes the
 * first Cmd+Enter after load land on the first stop.
 */
export function nextFlagKey(state: ReviewState, cursor: FieldKey | null, direction: 1 | -1): FieldKey | null {
  const keys = documentKeys(state);
  const position = cursor === null ? -1 : keys.indexOf(cursor);
  let index = position < 0 ? (direction === 1 ? 0 : keys.length - 1) : position + direction;

  while (index >= 0 && index < keys.length) {
    const key = keys[index]!;
    if (isFlagged(state.review[key])) return key;
    index += direction;
  }
  return null;
}

function isEmptyValue(value: FieldValue): boolean {
  return value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

/**
 * The value a key currently addresses. `null` (as opposed to an undefined
 * value) means the key points at nothing: an id that has been removed. A
 * record can only outlive its entry through a hydrate that skipped repair,
 * and such a record must not read as an empty field.
 */
function valueAt(state: ReviewState, key: FieldKey): { value: FieldValue } | null {
  const target = parseFieldKey(key);
  if (target.scope === "basics") return { value: readBasicsField(state.resume, target.field) };
  const located = indexOfId(state, target.id);
  if (!located) return null;
  const entry = listOf(state.resume, located.path)[located.index];
  return entry === undefined ? null : { value: readField(entry, target.field) };
}

/**
 * A stop that is parser silence rather than parser doubt: the record was
 * seeded at 0 (or the name scorer wrote 0) and the field is still empty.
 * The chip reads "Missing · Skip" instead of "Check · 0% · Looks right",
 * because there is no value to look at. It is a live check on the value,
 * not a stored kind, so the moment the user types the field stops being
 * "missing" without any record being rewritten.
 */
export function isSeededMissing(state: ReviewState, key: FieldKey): boolean {
  const record = state.review[key];
  if (!record || record.confidence !== 0) return false;
  const at = valueAt(state, key);
  return at !== null && isEmptyValue(at.value);
}
