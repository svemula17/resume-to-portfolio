/**
 * The corpus contract.
 *
 * A corpus entry is a Resume (the ground truth) rendered by a Layout into
 * HTML, printed to PDF by headless Chrome, and scored by running the real
 * pipeline over the PDF and comparing to the truth it came from. Because
 * the truth is known, scoring is automatic and exact — no hand-marking.
 *
 * Every person here is invented. Nothing in this corpus describes anyone.
 */
import type { Resume } from "../../src/schema/resume";

export type LayoutFamily = "single" | "two-column";

export type SectionId =
  | "basics"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications";

export interface Layout {
  id: string;
  family: LayoutFamily;
  /** One sentence: what real-world template this imitates. */
  description: string;
  /**
   * The order a human reads the sections in this layout. For a two-column
   * layout this is the order the pipeline is expected to produce — full-
   * width header, then the whole left column, then the whole right — which
   * is what the reading-order score checks against.
   */
  sectionOrder: SectionId[];
  /** A complete HTML document with all CSS inline. No external resources. */
  render(resume: Resume): string;
}

export interface Person {
  id: string;
  /** "short" fits one page with room; "long" spills to a second page. */
  size: "short" | "medium" | "long";
  resume: Resume;
}

export interface CorpusEntry {
  id: string;
  layout: string;
  family: LayoutFamily;
  person: string;
  sectionOrder: SectionId[];
  truth: Resume;
}
