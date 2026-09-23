/**
 * How each schema field is presented.
 *
 * "Generated from the Zod schema" is enforced at compile time, not at run
 * time. Every `fields` table below is checked with `satisfies` against the
 * schema's inferred type: add a field to ExperienceSchema and tsc fails
 * until a descriptor exists; remove one and the excess-property check fails.
 * descriptors.test.ts adds the run-time half — walking the schema and
 * asserting each widget suits its field's type — so `_zod.def` never
 * appears in product code and a Zod bump can break CI but never the app.
 *
 * Rejected: a runtime schema walker. It cannot know that summary is
 * multiline, that bullets want one-per-line paste, what a card's title is,
 * or which fields are worth a "Missing" stop — and a walker that throws at
 * module init turns a Zod minor bump into a blank page.
 */
import type {
  Basics,
  Certification,
  Education,
  Experience,
  Link,
  Project,
  SkillGroup,
} from "../../schema/resume";
import type { ListPath } from "./keys";
import type { ItemOf } from "./lists";

/** "select" is reserved for a future z.enum; the conformance test says so. */
export type Widget = "text" | "textarea" | "lines" | "tags" | "checkbox" | "list";

export interface FieldDescriptor {
  label: string;
  widget: Widget;
  /**
   * Parser silence on this field is worth a review stop. Kept deliberately
   * tiny — six fields — because every seeded stop is a keystroke on the
   * two-minute clock. If a resume's queue runs past ~15, `role` goes first.
   */
  core?: true;
  placeholder?: string;
  /** Name of a sibling boolean; when true, this control is disabled. */
  disabledWhen?: string;
}

export interface SectionDef<P extends ListPath> {
  path: P;
  label: string;
  /** "job", "degree" — for "Add job" and "Parse as job". */
  singular: string;
  /** Key order is render order. */
  fields: { readonly [F in keyof ItemOf<P>]-?: FieldDescriptor };
  empty(): ItemOf<P>;
  /** Collapsed-card line and the seed for aria-labels. */
  title(item: ItemOf<P>): string;
}

export const BASICS_FIELDS = {
  name: { label: "Name", widget: "text", core: true },
  title: { label: "Title", widget: "text", placeholder: "Senior Software Engineer" },
  summary: { label: "Summary", widget: "textarea" },
  email: { label: "Email", widget: "text" },
  phone: { label: "Phone", widget: "text" },
  location: { label: "Location", widget: "text", placeholder: "Austin, TX" },
  links: { label: "Links", widget: "list" },
} as const satisfies { readonly [F in keyof Basics]-?: FieldDescriptor };

function dateSpan(start?: string, end?: string, current?: boolean): string {
  if (!start && !end) return "";
  return `${start ?? ""}–${current ? "Present" : (end ?? "")}`;
}

const experience: SectionDef<"experience"> = {
  path: "experience",
  label: "Experience",
  singular: "job",
  fields: {
    role: { label: "Role", widget: "text", core: true },
    company: { label: "Company", widget: "text", core: true },
    location: { label: "Location", widget: "text" },
    startDate: { label: "Start", widget: "text", placeholder: "Jan 2021" },
    endDate: { label: "End", widget: "text", placeholder: "Present", disabledWhen: "current" },
    current: { label: "Current role", widget: "checkbox" },
    bullets: { label: "Bullets (one per line)", widget: "lines" },
  } satisfies { readonly [F in keyof Experience]-?: FieldDescriptor },
  empty: () => ({ bullets: [] }),
  title: (e) =>
    [[e.role, e.company].filter(Boolean).join(" · "), dateSpan(e.startDate, e.endDate, e.current)]
      .filter(Boolean)
      .join(" · ") || "New job",
};

const education: SectionDef<"education"> = {
  path: "education",
  label: "Education",
  singular: "degree",
  fields: {
    school: { label: "School", widget: "text", core: true },
    degree: { label: "Degree", widget: "text", placeholder: "BSc Computer Science" },
    field: { label: "Field", widget: "text" },
    startDate: { label: "Start", widget: "text", placeholder: "2015" },
    endDate: { label: "End", widget: "text", placeholder: "2019" },
    gpa: { label: "GPA", widget: "text", placeholder: "3.8/4.0" },
  } satisfies { readonly [F in keyof Education]-?: FieldDescriptor },
  empty: () => ({}),
  title: (d) => [d.degree, d.school].filter(Boolean).join(" · ") || "New degree",
};

const projects: SectionDef<"projects"> = {
  path: "projects",
  label: "Projects",
  singular: "project",
  fields: {
    name: { label: "Name", widget: "text", core: true },
    description: { label: "Description", widget: "textarea" },
    tech: { label: "Tech (comma-separated)", widget: "tags" },
    url: { label: "URL", widget: "text", placeholder: "github.com/you/project" },
  } satisfies { readonly [F in keyof Project]-?: FieldDescriptor },
  empty: () => ({ tech: [] }),
  title: (p) => p.name || "New project",
};

const skills: SectionDef<"skills"> = {
  path: "skills",
  label: "Skills",
  singular: "skill group",
  fields: {
    category: { label: "Category", widget: "text", placeholder: "Languages" },
    items: { label: "Skills (comma-separated)", widget: "tags" },
  } satisfies { readonly [F in keyof SkillGroup]-?: FieldDescriptor },
  empty: () => ({ items: [] }),
  title: (s) => s.category || (s.items.length > 0 ? s.items.slice(0, 3).join(", ") : "Skills"),
};

const certifications: SectionDef<"certifications"> = {
  path: "certifications",
  label: "Certifications",
  singular: "certification",
  fields: {
    name: { label: "Name", widget: "text", core: true },
    issuer: { label: "Issuer", widget: "text" },
    date: { label: "Date", widget: "text", placeholder: "2023" },
  } satisfies { readonly [F in keyof Certification]-?: FieldDescriptor },
  empty: () => ({}),
  title: (c) => c.name || "New certification",
};

const links: SectionDef<"basics.links"> = {
  path: "basics.links",
  label: "Links",
  singular: "link",
  fields: {
    label: { label: "Label", widget: "text", placeholder: "GitHub" },
    url: { label: "URL", widget: "text" },
  } satisfies { readonly [F in keyof Link]-?: FieldDescriptor },
  empty: () => ({ url: "" }),
  title: (l) => [l.label, l.url].filter(Boolean).join(" · ") || "New link",
};

export const SECTIONS: { readonly [P in ListPath]: SectionDef<P> } = {
  experience,
  education,
  projects,
  skills,
  certifications,
  "basics.links": links,
};

/** Field names of a section in render order. */
export function fieldNames<P extends ListPath>(path: P): string[] {
  return Object.keys(SECTIONS[path].fields);
}

export function coreFields<P extends ListPath>(path: P): string[] {
  const fields = SECTIONS[path].fields as Record<string, FieldDescriptor>;
  return Object.keys(fields).filter((name) => fields[name]?.core === true);
}

export const BASICS_FIELD_NAMES = Object.keys(BASICS_FIELDS) as Array<keyof typeof BASICS_FIELDS>;
