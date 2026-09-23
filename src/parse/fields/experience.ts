/**
 * Work experience.
 *
 * The shape of an entry is remarkably consistent across templates: one or two
 * heading lines carrying role, company, location and dates in some order,
 * followed by bullets. What varies is only which of those sits on which line,
 * so the parser identifies the bullets first — they are unambiguous — and
 * then scores what remains.
 */
import type { Line } from "../../layout";
import type { Experience } from "../../schema/resume";
import { feature, pickBest, type Feature } from "../features";
import { INTL_LOCATION, isBulletLine, stripBullet, US_LOCATION } from "../text";
import { findDateRange, stripDateRange } from "./dates";

/**
 * Company names carry legal suffixes and are rarely seniority-marked.
 * Role titles carry seniority words and rarely carry a suffix. Where both
 * share a line, the delimiter usually separates them.
 */
const ROLE_WORDS =
  /\b(engineer|developer|analyst|manager|director|architect|consultant|designer|scientist|administrator|specialist|lead|head|intern|associate|officer|president|founder|researcher|technician)\b/i;

const SENIORITY = /\b(senior|staff|principal|junior|lead|chief|head|vp|vice president|sr\.?|jr\.?)\b/i;

const COMPANY_SUFFIX =
  /\b(inc\.?|llc|ltd\.?|corp\.?|corporation|gmbh|plc|co\.?|company|technologies|solutions|systems|labs|group|holdings|partners|consulting|university|institute)\b/i;

const ROLE_FEATURES: Feature<string>[] = [
  feature("contains a role word", 4, (text) => ROLE_WORDS.test(text)),
  feature("contains a seniority word", 2, (text) => SENIORITY.test(text)),
  feature("contains a company suffix", -4, (text) => COMPANY_SUFFIX.test(text)),
  feature("contains a location", -2, (text) => US_LOCATION.test(text)),
  feature("short", 1, (text) => text.length <= 50),
  feature("very long", -3, (text) => text.length > 70),
];

const COMPANY_FEATURES: Feature<string>[] = [
  feature("contains a company suffix", 4, (text) => COMPANY_SUFFIX.test(text)),
  feature("contains a location", 2, (text) => US_LOCATION.test(text) || INTL_LOCATION.test(text)),
  feature("contains a role word", -3, (text) => ROLE_WORDS.test(text)),
  feature("title case", 1, (text) => /^[A-Z]/.test(text)),
  feature("very long", -3, (text) => text.length > 70),
];

/** Split "Datadog -- United States (Remote)" into company and location. */
const HEADING_DELIMITER = /\s+(?:--|—|–|\||·|•)\s+|\s{3,}/;

function extractLocation(text: string): { rest: string; location?: string } {
  const match = US_LOCATION.exec(text) ?? INTL_LOCATION.exec(text);
  if (!match) return { rest: text };
  return {
    rest: text.replace(match[0], "").replace(/\s*[|•·,–—-]\s*$/, "").trim(),
    location: match[0],
  };
}

export interface ParsedEntry<T> {
  value: T;
  confidence: Record<string, number>;
}

export function parseExperienceEntry(lines: Line[], index: number): ParsedEntry<Experience> {
  const prefix = `experience.${index}`;
  const confidence: Record<string, number> = {};

  const bullets = lines
    .filter((line) => isBulletLine(line.text))
    .map((line) => stripBullet(line.text));

  const headingLines = lines.filter((line) => !isBulletLine(line.text));

  const range = findDateRange(headingLines);
  if (range) {
    confidence[`${prefix}.startDate`] = 0.9;
    if (range.endDate) confidence[`${prefix}.endDate`] = 0.9;
  }

  // Heading text with the date range removed, then split on delimiters, so a
  // line like "Datadog -- United States | June 2025 - Present" yields two
  // clean candidates rather than one soup.
  const candidates: string[] = [];
  headingLines.forEach((line, lineIndex) => {
    const text =
      range && range.lineIndex === lineIndex
        ? stripDateRange(line.text, range.matchedText)
        : line.text;
    for (const part of text.split(HEADING_DELIMITER)) {
      const trimmed = part.trim();
      if (trimmed !== "") candidates.push(trimmed);
    }
  });

  const role = pickBest(candidates, ROLE_FEATURES);
  const companyPool = candidates.filter((text) => text !== role?.value);
  const company = pickBest(companyPool, COMPANY_FEATURES);

  let location: string | undefined;
  let companyText = company?.value;
  if (companyText) {
    const extracted = extractLocation(companyText);
    location = extracted.location;
    // Only take the remainder if something survived — "Austin, TX" alone on a
    // line is a location, not a company with its location stripped off.
    if (extracted.rest !== "") companyText = extracted.rest;
  }
  if (!location) {
    for (const candidate of candidates) {
      const match = US_LOCATION.exec(candidate) ?? INTL_LOCATION.exec(candidate);
      if (match) {
        location = match[0];
        break;
      }
    }
  }

  if (role) confidence[`${prefix}.role`] = role.confidence;
  if (company) confidence[`${prefix}.company`] = company.confidence;
  if (location) confidence[`${prefix}.location`] = 0.75;
  if (bullets.length > 0) confidence[`${prefix}.bullets`] = 0.95;

  return {
    value: {
      company: companyText,
      role: role?.value,
      startDate: range?.startDate,
      endDate: range?.endDate,
      current: range?.current,
      location,
      bullets,
    },
    confidence,
  };
}
