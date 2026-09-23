/**
 * Core patterns and text helpers shared by every field parser.
 *
 * Kept in one module so the regexes are testable in isolation and so there is
 * exactly one definition of "what a phone number looks like". A regex copied
 * into two parsers is a regex that will be fixed in one of them.
 */

/** Permissive on purpose: anything with an @ and a dot after it. */
export const EMAIL = /[^\s<>()[\]]+@[^\s<>()[\]]+\.[A-Za-z]{2,}/;

/**
 * North American formats, plus an optional country code and extension.
 * Separators are optional because pdf.js strips them about as often as not.
 */
export const PHONE =
  /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?:\s*(?:x|ext\.?)\s*\d{1,5})?/i;

/** "Jersey City, NJ" / "Austin, TX". Two-letter state codes only. */
export const US_LOCATION = /\b[A-Z][a-zA-Z.'-]*(?:[ \t][A-Z][a-zA-Z.'-]*)*,\s*[A-Z]{2}\b/;

/** "Mumbai, India" / "Berlin, Germany" — a capitalised word after a comma. */
export const INTL_LOCATION =
  /\b[A-Z][a-zA-Z.'-]*(?:[ \t][A-Z][a-zA-Z.'-]*)*,\s*[A-Z][a-zA-Z]{3,}\b/;

export const GPA = /\b([0-4]\.\d{1,2})\s*(?:\/\s*([0-5](?:\.\d{1,2})?))?/;

export const YEAR = /\b(?:19|20)\d{2}\b/;

/** A bare URL or a bare domain. Resumes write both, usually without a scheme. */
export const URL =
  /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}(?:\/[^\s|,]*)?/;

const MONTH = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?";
const YEAR_SOURCE = "(?:19|20)\\d{2}";
const POINT = `(?:${MONTH}\\s+${YEAR_SOURCE}|\\d{1,2}/${YEAR_SOURCE}|${MONTH}\\.?\\s*'?\\d{2}|${YEAR_SOURCE})`;
const PRESENT = "Present|Current|Now|Ongoing|Today";

/**
 * A date range. En-dash, em-dash, hyphen, the word "to", and the various ways
 * "still there" gets written all appear on real resumes, so all of them parse.
 */
export const DATE_RANGE = new RegExp(
  `(${POINT})\\s*(?:[-–—−]|to|until|\\u2192)\\s*(${POINT}|${PRESENT})`,
  "i",
);

/** A single date with no range around it — used for certifications. */
export const DATE_POINT = new RegExp(POINT, "i");

export const PRESENT_WORD = new RegExp(`^(?:${PRESENT})$`, "i");

/** Bullet glyphs resumes use, plus the hyphen that stands in for them. */
const BULLET_PREFIX = /^\s*[•▪◦‣∙·*●▪•‣◦⁃∙-]\s+/;

export function isBulletLine(text: string): boolean {
  return BULLET_PREFIX.test(text);
}

export function stripBullet(text: string): string {
  return text.replace(BULLET_PREFIX, "").trim();
}

/** Collapse whitespace and drop a trailing colon, for header comparison. */
export function normalizeHeading(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/[:：]\s*$/, "").toLowerCase();
}

/**
 * True when the letters present are all uppercase.
 *
 * Digits and punctuation are ignored rather than counted as "not uppercase",
 * so "SKILLS & TOOLS" and "EDUCATION (2019)" still read as all-caps. A string
 * with no letters at all is not a heading.
 */
export function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, "");
  return letters.length > 0 && letters === letters.toUpperCase();
}

export function titleCaseRatio(text: string): number {
  const words = text.split(/\s+/).filter((word) => /^[A-Za-z]/.test(word));
  if (words.length === 0) return 0;
  const capitalised = words.filter((word) => /^[A-Z]/.test(word)).length;
  return capitalised / words.length;
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
