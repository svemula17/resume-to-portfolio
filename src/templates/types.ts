/**
 * What a template is.
 *
 * A pure function from a normalised Resume to two files. Nothing else:
 * no state, no DOM, no fetch, no clock. That is what lets three of them
 * coexist as siblings that share nothing but this file and escape.ts, and
 * what lets the whole output be snapshot-tested.
 */
import type { Resume } from "../schema/resume";

export const TEMPLATE_IDS = ["minimal", "developer", "creative"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export function isTemplateId(value: string | null | undefined): value is TemplateId {
  return (TEMPLATE_IDS as readonly string[]).includes(value ?? "");
}

export interface TemplateMeta {
  id: TemplateId;
  name: string;
  /** One sentence for the picker. */
  description: string;
  /** Three or four short traits: "Single column", "Print-first". */
  traits: readonly string[];
}

/** The two files a template produces. index.html links ./styles.css. */
export interface RenderedSite {
  "index.html": string;
  "styles.css": string;
}

export interface Template {
  meta: TemplateMeta;
  /**
   * `resume` is already normalised (export.ts): strings trimmed, empties
   * gone, links all have a url, endDate absent when current. A template
   * still guards every optional field — a section with no entries is
   * simply not rendered.
   */
  render(resume: Resume): RenderedSite;
}
