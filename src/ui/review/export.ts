/**
 * The boundary between working state and the contract.
 *
 * While the form is open, `state.resume` holds whatever the user typed:
 * strings with trailing spaces, "" in an optional field they cleared, a
 * trailing "" bullet from a newline, an endDate hiding behind a checked
 * "Current" box. None of that is wrong to hold — rewriting it under the
 * caret is what the exact-inverse widgets exist to avoid — but none of it
 * belongs in resume.json. So the single source of truth is enforced here,
 * once, at export, rather than per keystroke: `normalise` cleans and then
 * runs the real `ResumeSchema.parse`, and only its output ever reaches the
 * file or a template.
 *
 * `issues` is the same cleaning without the throw, with Zod's index paths
 * translated back into the form's ids so an error can be shown on the
 * control that owns it.
 */
import { ResumeSchema, type Basics, type Experience, type Link, type Resume } from "../../schema/resume";
import { fieldNames } from "./descriptors";
import { LIST_PATHS, fieldKey, type EntryId, type FieldKey, type ListPath } from "./keys";
import type { FieldValue } from "./lists";
import type { ReviewState } from "./state";

export interface Issue {
  key: FieldKey;
  message: string;
}

/**
 * One rule for every scalar the schema has: trim, and treat an empty
 * string as absent. Nothing in the contract distinguishes "" from
 * undefined, and templates should not have to.
 */
function cleanValue(value: FieldValue): FieldValue {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter((item) => item !== "");
  }
  return value;
}

/**
 * Applies `cleanValue` to every field and omits the ones that came back
 * absent. Omitting rather than assigning undefined matters: Zod keeps an
 * own key whose value is undefined, and `toStrictEqual` and `"x" in obj`
 * would then see a field the JSON does not have.
 *
 * Generic over the entry rather than written per section so a field added
 * to the schema is normalised the day it exists instead of silently
 * dropped by a hand-maintained list. The cast is the same one lists.ts
 * makes: every entry field is a FieldValue, by construction of the schema.
 */
function cleanFields<T extends Record<string, FieldValue>>(fields: T): T {
  const next: Record<string, FieldValue> = {};
  for (const [field, value] of Object.entries(fields)) {
    const cleaned = cleanValue(value);
    if (cleaned !== undefined) next[field] = cleaned;
  }
  return next as T;
}

function cleanExperience(job: Experience): Experience {
  const next = cleanFields(job);
  // The End control keeps its text while "Current" is checked so that
  // unchecking restores it; the contract, like the parser, has one or the
  // other.
  if (next.current === true) delete next.endDate;
  return next;
}

function cleanLink(link: Link): Link {
  const next = cleanFields(link);
  // url is required, so an absent one must stay a string for the parser
  // to reject; the caller drops these before parsing anyway.
  return { ...next, url: next.url ?? "" };
}

function cleanBasics(basics: Basics): Basics {
  const { name, links, ...rest } = basics;
  return {
    ...cleanFields(rest),
    // The one required string. Kept as "" rather than dropped so Zod
    // reports "A name is required", not "expected string, received undefined".
    name: name.trim(),
    // A link with no url is what "Add link" creates and what a cleared
    // field leaves behind; neither is an error worth a stop. Dropping them
    // here is why basics.name is the only reachable issue.
    links: links.map(cleanLink).filter((link) => link.url !== ""),
  };
}

/** Everything but the final parse, shared by `normalise` and `issues`. */
function cleaned(resume: Resume): Resume {
  return {
    basics: cleanBasics(resume.basics),
    experience: resume.experience.map(cleanExperience),
    education: resume.education.map(cleanFields),
    projects: resume.projects.map(cleanFields),
    skills: resume.skills.map(cleanFields),
    certifications: resume.certifications.map(cleanFields),
  };
}

/**
 * The working resume as the contract sees it. Pure: the input is never
 * touched. Throws on the one thing cleaning cannot fix — an empty name —
 * so call `issues` first; the Download button does.
 */
export function normalise(resume: Resume): Resume {
  return ResumeSchema.parse(cleaned(resume));
}

/** What Download writes and what stage 4 templates receive. */
export function toResumeJson(state: ReviewState): string {
  return `${JSON.stringify(normalise(state.resume), null, 2)}\n`;
}

/**
 * A Zod issue path → the FieldKey of the control that owns it.
 *
 * ["basics","name"] → "basics.name"; ["experience",0,"company"] → "e1.company";
 * ["basics","links",1,"url"] → "l2.url". The rule is general over every
 * list path even though, after cleaning, only basics.name can fail: a
 * schema that grows a second required leaf should place its error without
 * a change here.
 *
 * Nothing falls off the end. An issue on an entry with no field lands on
 * that entry's first field, and an issue nowhere the form can address
 * lands on basics.name. A dropped issue would let the header say
 * "0 issues" while `normalise` throws, and the top of the form is the
 * least surprising place for an error that has no other home.
 */
export function issueKey(path: ReadonlyArray<PropertyKey>, entryIds: Record<ListPath, EntryId[]>): FieldKey {
  const fallback: FieldKey = "basics.name";

  // Longest path first so "basics.links" is tried before "basics".
  const listPaths = [...LIST_PATHS].sort((a, b) => b.length - a.length);
  for (const listPath of listPaths) {
    const segments = listPath.split(".");
    const matches = segments.every((segment, i) => path[i] === segment);
    if (!matches) continue;
    const index = path[segments.length];
    if (typeof index !== "number") break;
    const id = entryIds[listPath][index];
    if (!id) return fallback;
    const field = path[segments.length + 1];
    const name = typeof field === "string" ? field : fieldNames(listPath)[0];
    return name ? fieldKey(id, name) : fallback;
  }

  if (path[0] === "basics" && typeof path[1] === "string") return fieldKey("basics", path[1]);
  return fallback;
}

/** Every reason the current working state would not export, by control. */
export function issues(state: ReviewState): Issue[] {
  const result = ResumeSchema.safeParse(cleaned(state.resume));
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    key: issueKey(issue.path, state.entryIds),
    message: issue.message,
  }));
}
