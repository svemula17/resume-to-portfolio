/**
 * The resume schema is the only interface between the two halves of this app.
 *
 * Parsers write to it; templates read from it. Adding a template touches no
 * parser code, adding a parser touches no template code. Every field is
 * optional except `basics.name`, because a rule-based parser on a heavily
 * designed PDF will legitimately come up empty for most of them — the review
 * form, not the schema, is what guarantees the data is complete.
 */
import { z } from "zod";

/** A URL the candidate links to: GitHub, LinkedIn, a personal site. */
export const LinkSchema = z.object({
  /** "GitHub", "LinkedIn", "Portfolio" — inferred from the host where possible. */
  label: z.string().optional(),
  url: z.string(),
});

/**
 * Dates stay strings rather than Date objects on purpose. Resumes write
 * "Jan 2021", "2021", "01/2021" and "Present", and normalising those to a
 * timestamp throws away information the templates want to render verbatim.
 */
export const DateStringSchema = z.string();

export const BasicsSchema = z.object({
  /** The only required field in the whole schema. */
  name: z.string().min(1, "A name is required"),
  title: z.string().optional(),
  summary: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  links: z.array(LinkSchema).default([]),
});

export const ExperienceSchema = z.object({
  company: z.string().optional(),
  role: z.string().optional(),
  startDate: DateStringSchema.optional(),
  endDate: DateStringSchema.optional(),
  /** Set when the end of the range parsed as "Present" or "Current". */
  current: z.boolean().optional(),
  location: z.string().optional(),
  bullets: z.array(z.string()).default([]),
});

export const EducationSchema = z.object({
  school: z.string().optional(),
  degree: z.string().optional(),
  field: z.string().optional(),
  startDate: DateStringSchema.optional(),
  endDate: DateStringSchema.optional(),
  gpa: z.string().optional(),
});

export const ProjectSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  tech: z.array(z.string()).default([]),
  url: z.string().optional(),
});

export const SkillGroupSchema = z.object({
  /** "Languages", "Frameworks" — absent when the resume lists skills flat. */
  category: z.string().optional(),
  items: z.array(z.string()).default([]),
});

export const CertificationSchema = z.object({
  name: z.string().optional(),
  issuer: z.string().optional(),
  date: DateStringSchema.optional(),
});

export const ResumeSchema = z.object({
  basics: BasicsSchema,
  experience: z.array(ExperienceSchema).default([]),
  education: z.array(EducationSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
  skills: z.array(SkillGroupSchema).default([]),
  certifications: z.array(CertificationSchema).default([]),
});

export type Link = z.infer<typeof LinkSchema>;
export type Basics = z.infer<typeof BasicsSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type SkillGroup = z.infer<typeof SkillGroupSchema>;
export type Certification = z.infer<typeof CertificationSchema>;
export type Resume = z.infer<typeof ResumeSchema>;

/**
 * Confidence per parsed field, keyed by dotted path into a Resume:
 * `basics.name`, `experience.0.company`, `skills.1.items`.
 *
 * 0 means "guessed", 1 means "certain". The review form flags anything below
 * CONFIDENCE_REVIEW_THRESHOLD so the user's attention lands where the parser
 * is weakest instead of being spread evenly across every field.
 */
export type ConfidenceMap = Record<string, number>;

/** Below this, a field is visually flagged for review. */
export const CONFIDENCE_REVIEW_THRESHOLD = 0.6;

/** What a parser hands back: the data plus how much it trusts each field. */
export interface ParseResult {
  data: Resume;
  confidence: ConfidenceMap;
}

/** An empty but schema-valid resume, used as the starting point for the form. */
export function emptyResume(name = ""): Resume {
  return ResumeSchema.parse({ basics: { name: name || "Unknown" } });
}
