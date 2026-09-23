/**
 * Identity for the review form.
 *
 * The parser addresses fields by index — "experience.0.company" — which is
 * fine for a value that is read once and wrong for a form where entries are
 * added, removed and reordered. Here every list entry gets an id at load
 * time and every review record is keyed by that id, so removing an entry
 * deletes its records by prefix and reordering touches nothing.
 *
 * Ids are a letter plus a counter from persisted state, never random. The
 * reducer stays pure under StrictMode's double invocation, tests compare
 * with toEqual on hand-built state, and the counter survives a reload.
 */

/** The five top-level sections, in the order the form shows them. */
export const SECTION_ORDER = ["experience", "education", "projects", "skills", "certifications"] as const;

/** Every array of objects in a Resume, by dotted path. */
export const LIST_PATHS = [...SECTION_ORDER, "basics.links"] as const;

export type SectionPath = (typeof SECTION_ORDER)[number];
export type ListPath = (typeof LIST_PATHS)[number];

export const ID_PREFIX = {
  experience: "e",
  education: "d",
  projects: "p",
  skills: "s",
  certifications: "c",
  "basics.links": "l",
} as const satisfies Record<ListPath, string>;

type IdPrefix = (typeof ID_PREFIX)[ListPath];

export type EntryId = `${IdPrefix}${number}`;
export type BlockId = `b${number}`;

/** "basics.name", "basics.links" (the group), "e3.company". */
export type FieldKey = `basics.${string}` | `${EntryId}.${string}`;

const PATH_OF_PREFIX: Record<IdPrefix, ListPath> = {
  e: "experience",
  d: "education",
  p: "projects",
  s: "skills",
  c: "certifications",
  l: "basics.links",
};

const FIELD_KEY_PATTERN = /^(?:basics\.[a-zA-Z]+|[edpscl]\d+\.[a-zA-Z]+)$/;
const ENTRY_ID_PATTERN = /^([edpscl])(\d+)$/;

export function entryId(path: ListPath, n: number): EntryId {
  return `${ID_PREFIX[path]}${n}`;
}

export function blockId(n: number): BlockId {
  return `b${n}`;
}

export function isEntryId(value: string): value is EntryId {
  return ENTRY_ID_PATTERN.test(value);
}

/** Which list an id belongs to, from its first letter. */
export function pathOfId(id: EntryId): ListPath {
  return PATH_OF_PREFIX[id[0] as IdPrefix];
}

/** The numeric part, for repairing nextId after a reload. */
export function idNumber(id: EntryId | BlockId): number {
  return Number(id.slice(1));
}

export function fieldKey(scope: "basics" | EntryId, field: string): FieldKey {
  return `${scope}.${field}`;
}

export function parseFieldKey(
  key: FieldKey,
): { scope: "basics"; field: string } | { scope: "entry"; id: EntryId; field: string } {
  const dot = key.indexOf(".");
  const head = key.slice(0, dot);
  const field = key.slice(dot + 1);
  if (head === "basics") return { scope: "basics", field };
  return { scope: "entry", id: head as EntryId, field };
}

/** Used on hydrate: anything that is not shaped like a key is dropped. */
export function isFieldKey(value: string): value is FieldKey {
  return FIELD_KEY_PATTERN.test(value);
}
