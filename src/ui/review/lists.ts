/**
 * Typed access to the six entry lists of a Resume.
 *
 * This is the only file in the review layer that casts. Every other module
 * addresses a list through `ListPath` and a field through a descriptor
 * (descriptors.ts), and the descriptor tables are compile-checked against
 * the schema — which is what makes the casts here safe rather than hopeful.
 */
import type {
  Certification,
  Education,
  Experience,
  Link,
  Project,
  Resume,
  SkillGroup,
} from "../../schema/resume";
import type { ListPath } from "./keys";

export type ListOf<P extends ListPath> = P extends "experience"
  ? Experience[]
  : P extends "education"
    ? Education[]
    : P extends "projects"
      ? Project[]
      : P extends "skills"
        ? SkillGroup[]
        : P extends "certifications"
          ? Certification[]
          : P extends "basics.links"
            ? Link[]
            : never;

export type ItemOf<P extends ListPath> = ListOf<P>[number];
export type ListEntry = Experience | Education | Project | SkillGroup | Certification | Link;

/** What a field can hold. Nothing in the schema is anything else. */
export type FieldValue = string | boolean | string[] | undefined;

export function listOf<P extends ListPath>(resume: Resume, path: P): ListOf<P> {
  switch (path) {
    case "experience":
      return resume.experience as ListOf<P>;
    case "education":
      return resume.education as ListOf<P>;
    case "projects":
      return resume.projects as ListOf<P>;
    case "skills":
      return resume.skills as ListOf<P>;
    case "certifications":
      return resume.certifications as ListOf<P>;
    case "basics.links":
      return resume.basics.links as ListOf<P>;
  }
  // Exhaustive: every ListPath is handled above.
  throw new Error(`Unknown list path: ${String(path)}`);
}

export function withList<P extends ListPath>(resume: Resume, path: P, next: ListOf<P>): Resume {
  switch (path) {
    case "experience":
      return { ...resume, experience: next as Experience[] };
    case "education":
      return { ...resume, education: next as Education[] };
    case "projects":
      return { ...resume, projects: next as Project[] };
    case "skills":
      return { ...resume, skills: next as SkillGroup[] };
    case "certifications":
      return { ...resume, certifications: next as Certification[] };
    case "basics.links":
      return { ...resume, basics: { ...resume.basics, links: next as Link[] } };
  }
  throw new Error(`Unknown list path: ${String(path)}`);
}

export function readField(entry: ListEntry, field: string): FieldValue {
  return (entry as Record<string, FieldValue>)[field];
}

export function setEntryField<E extends ListEntry>(entry: E, field: string, value: FieldValue): E {
  return { ...entry, [field]: value };
}

export function readBasicsField(resume: Resume, field: string): FieldValue {
  return (resume.basics as unknown as Record<string, FieldValue>)[field];
}

export function setBasicsField(resume: Resume, field: string, value: FieldValue): Resume {
  return { ...resume, basics: { ...resume.basics, [field]: value } };
}
