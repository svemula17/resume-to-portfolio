/**
 * Split a resume's lines into labelled sections.
 *
 * Everything downstream keys off this. A field parser is only ever handed the
 * lines belonging to its own section, which is what keeps the scoring
 * tractable: "which line is the company name" is answerable inside an
 * experience entry and hopeless across a whole document.
 */
import type { Line } from "../layout";
import { isAllCaps, normalizeHeading } from "./text";

export type SectionKind =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "awards"
  | "publications"
  | "volunteer"
  | "languages"
  | "interests"
  | "references"
  | "unknown";

/**
 * Heading aliases, normalised (lowercased, trailing colon stripped).
 *
 * Deliberately a lookup table rather than fuzzy matching: a resume heading is
 * drawn from a small, well-known vocabulary, and fuzzy matching here buys
 * nothing but false positives on job titles.
 */
const HEADINGS: Record<string, SectionKind> = {
  summary: "summary",
  "professional summary": "summary",
  "career summary": "summary",
  "executive summary": "summary",
  objective: "summary",
  "career objective": "summary",
  profile: "summary",
  "professional profile": "summary",
  about: "summary",
  "about me": "summary",

  experience: "experience",
  "work experience": "experience",
  "professional experience": "experience",
  "relevant experience": "experience",
  employment: "experience",
  "employment history": "experience",
  "work history": "experience",
  "career history": "experience",

  education: "education",
  "academic background": "education",
  "academic qualifications": "education",
  qualifications: "education",

  skills: "skills",
  "technical skills": "skills",
  "core competencies": "skills",
  competencies: "skills",
  technologies: "skills",
  "technical proficiencies": "skills",
  "tools and technologies": "skills",
  "skills & tools": "skills",

  projects: "projects",
  "personal projects": "projects",
  "selected projects": "projects",
  "key projects": "projects",

  certifications: "certifications",
  certificates: "certifications",
  licenses: "certifications",
  "licenses & certifications": "certifications",
  "certifications & licenses": "certifications",

  awards: "awards",
  honors: "awards",
  "honours": "awards",
  "awards & honors": "awards",
  achievements: "awards",

  publications: "publications",
  research: "publications",
  "publications & research": "publications",

  volunteer: "volunteer",
  "volunteer experience": "volunteer",
  volunteering: "volunteer",

  languages: "languages",
  interests: "interests",
  hobbies: "interests",
  references: "references",
};

/**
 * A structurally-detected heading must be shorter than this. Section headings
 * are one or two words; anything longer that happens to be capitalised is a
 * job title or a company name.
 */
const MAX_STRUCTURAL_HEADING_CHARS = 32;

/**
 * Structural detection is switched off for the first few lines of a document.
 *
 * That region is the name and contact block by construction, and a name set
 * in bold capitals is indistinguishable from a section heading by any
 * structural rule — "SAI KUMAR VEMULA" passes every test that "EXPERIENCE"
 * does. Keyword matching still applies there, so a resume that genuinely
 * opens with "SUMMARY" is unaffected.
 */
const STRUCTURAL_SUPPRESSED_LINES = 3;

export interface Section {
  kind: SectionKind;
  /** The heading line's text, or null for the preamble above the first one. */
  heading: string | null;
  lines: Line[];
}

/**
 * Keyword lookup. Strong evidence: this is a known heading, verbatim.
 *
 * Falls back to a prefix match — "Publications & Community", "Skills and
 * Tools", "Education & Training" — when the heading opens with a known
 * alias followed by a joiner and a short remainder. Both conditions are
 * load-bearing. The joiner is what stops "Experience with distributed
 * systems" matching. The short, comma-free remainder is what stops
 * "Languages: Go, Python, TypeScript" — a skills line — being read as a
 * heading for a languages section, which on the first run swallowed every
 * labelled skill group on the page. A colon is deliberately not a joiner
 * for the same reason: after a colon comes content.
 */
export function matchHeadingKeyword(text: string): SectionKind | null {
  const normalized = normalizeHeading(text);
  const exact = HEADINGS[normalized];
  if (exact) return exact;

  const joiner = /^(.+?)\s*(?:&|and|\/|-{1,2}|—|–)\s+([^,:]{1,25})$/.exec(normalized);
  if (joiner) {
    const prefix = HEADINGS[joiner[1]!.trim()];
    if (prefix) return prefix;
  }

  return null;
}

/**
 * The fallback from the spec: alone on its line, bold, and all-caps.
 *
 * In practice this carries far more weight than intended, because the
 * keyword table cannot know about "MY TOOLBOX" or a heading in another
 * language. It also carries less weight than intended in the other
 * direction: pdf.js reports a generic font family for many documents, so
 * `bold` is false for every line in them and this rule never fires at all.
 * Hence `bold` is treated as supporting evidence rather than a requirement,
 * with the length and all-caps constraints doing the real filtering.
 */
function isStructuralHeading(line: Line, index: number): boolean {
  if (index < STRUCTURAL_SUPPRESSED_LINES) return false;
  if (line.items.length !== 1) return false;
  if (line.text.length > MAX_STRUCTURAL_HEADING_CHARS) return false;
  if (!isAllCaps(line.text)) return false;
  // A heading is a label, not a sentence or a date.
  if (/[.,;]/.test(line.text)) return false;
  if (!/[A-Za-z]/.test(line.text)) return false;
  return true;
}

export interface HeadingHit {
  index: number;
  kind: SectionKind;
  text: string;
}

/** Every line that looks like a section heading, in document order. */
export function findHeadings(lines: Line[]): HeadingHit[] {
  const hits: HeadingHit[] = [];

  lines.forEach((line, index) => {
    const keyword = matchHeadingKeyword(line.text);
    if (keyword) {
      hits.push({ index, kind: keyword, text: line.text });
      return;
    }
    if (isStructuralHeading(line, index)) {
      // Unknown kind: the heading is real, but nothing maps it to a field
      // parser. Its content is preserved and shown in the review form rather
      // than silently dropped.
      hits.push({ index, kind: "unknown", text: line.text });
    }
  });

  return hits;
}

/**
 * Partition lines into sections.
 *
 * Lines above the first heading become the preamble — heading `null` — which
 * is where the name and contact details live on essentially every resume.
 */
export function splitIntoSections(lines: Line[]): Section[] {
  const headings = findHeadings(lines);
  const sections: Section[] = [];

  const firstHeadingIndex = headings[0]?.index ?? lines.length;
  if (firstHeadingIndex > 0) {
    sections.push({ kind: "unknown", heading: null, lines: lines.slice(0, firstHeadingIndex) });
  }

  headings.forEach((heading, position) => {
    const next = headings[position + 1]?.index ?? lines.length;
    sections.push({
      kind: heading.kind,
      heading: heading.text,
      // The heading line itself is excluded: it is a label, not content, and
      // leaving it in means every field parser has to skip it.
      lines: lines.slice(heading.index + 1, next),
    });
  });

  return sections;
}

/** The preamble, if there is one. */
export function preambleOf(sections: Section[]): Line[] {
  return sections.find((section) => section.heading === null)?.lines ?? [];
}

/** All lines belonging to sections of a given kind, concatenated. */
export function linesOfKind(sections: Section[], kind: SectionKind): Line[] {
  return sections
    .filter((section) => section.kind === kind && section.heading !== null)
    .flatMap((section) => section.lines);
}

/** Sections of a given kind, kept separate. */
export function sectionsOfKind(sections: Section[], kind: SectionKind): Section[] {
  return sections.filter((section) => section.kind === kind && section.heading !== null);
}
