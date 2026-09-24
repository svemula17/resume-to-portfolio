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
export const ROLE_WORDS =
  /\b(engineer|developer|analyst|manager|director|architect|consultant|designer|scientist|administrator|specialist|lead|head|intern|associate|officer|president|founder|researcher|technician)\b/i;

const SENIORITY = /\b(senior|staff|principal|junior|lead|chief|head|vp|vice president|sr\.?|jr\.?)\b/i;

/**
 * A legal or house-style suffix, at the end of the name — "Cisco Systems",
 * "Acme Inc., Austin, TX", "Initech Labs (Remote)". Anchored, because
 * "Systems Administrator" contains the word and is a job title; unanchored
 * it out-scored the actual company on the line above it.
 */
const COMPANY_SUFFIX =
  /\b(inc\.?|llc|ltd\.?|corp\.?|corporation|gmbh|plc|co\.?|company|technologies|solutions|systems|labs|group|holdings|partners|consulting|university|institute)\b\.?(?:\s*\(.*\)|,\s*.*)?$/i;

/**
 * A heading fragment, with where it came from. Position turns out to be as
 * informative as content: the company is almost always on the line that
 * carries the dates, and the role is almost always the first thing written.
 */
export interface Candidate {
  text: string;
  lineIndex: number;
  partIndex: number;
  onDateLine: boolean;
}

const REMOTE = /\b(remote|hybrid|on-?site|wfh)\b/i;

/** Countries and regions that stand alone as a location before "(Remote)". */
const REGION = /^(?:united states|usa|u\.s\.a?\.?|united kingdom|uk|canada|india|germany|france|australia|europe|emea|apac|worldwide|global)$/i;

function isOnlyLocation(text: string): boolean {
  // "Halcyon Pay, Remote" matches the City, Country shape and is a company
  // with a work arrangement. Take the arrangement off first; what is left
  // is a location only if it is one on its own.
  const arrangement = /^(.*?)[\s,]*\(?\b(remote|hybrid|on-?site)\b\)?\s*$/i.exec(text);
  if (arrangement) {
    const rest = arrangement[1]!.replace(/[\s,]+$/, "").trim();
    if (rest === "") return true;
    return REGION.test(rest) || US_LOCATION.test(rest) || INTL_LOCATION.test(rest);
  }
  const stripped = text.replace(/[()]/g, "").trim();
  const match = US_LOCATION.exec(stripped) ?? INTL_LOCATION.exec(stripped);
  if (match && match[0].length >= stripped.length - 2) return true;
  return REMOTE.test(stripped) && stripped.length <= 30;
}

export const ROLE_FEATURES: Feature<Candidate>[] = [
  feature("contains a role word", 4, ({ text }) => ROLE_WORDS.test(text)),
  feature("contains a seniority word", 2, ({ text }) => SENIORITY.test(text)),
  feature("is the first fragment", 1, ({ lineIndex, partIndex }) => lineIndex === 0 && partIndex === 0),
  feature("contains a company suffix", -4, ({ text }) => COMPANY_SUFFIX.test(text)),
  feature("is only a location", -6, ({ text }) => isOnlyLocation(text)),
  feature("contains a location", -2, ({ text }) => US_LOCATION.test(text)),
  feature("short", 1, ({ text }) => text.length <= 50),
  feature("very long", -3, ({ text }) => text.length > 70),
];

/**
 * "Splunk, Terraform, Kubernetes" is a skills line, not an employer — but
 * "Northwind Freight, Chicago, IL" is the commonest company line there is,
 * and it has two commas too. The location comes off first; what is left
 * is a list only if commas remain between it and its parts.
 */
function looksLikeList(text: string): boolean {
  const withoutLocation = extractLocation(text).rest;
  return /,.*,/.test(withoutLocation) || /,\s*\S+,/.test(withoutLocation);
}

export const COMPANY_FEATURES: Feature<Candidate>[] = [
  feature("contains a company suffix", 4, ({ text }) => COMPANY_SUFFIX.test(text)),
  feature("looks like a comma list", -4, ({ text }) => looksLikeList(text)),
  // The strongest structural signal there is: templates put the dates on the
  // company line far more often than on the role line.
  feature("shares a line with the dates", 3, ({ onDateLine }) => onDateLine),
  feature("first fragment on its line", 1, ({ partIndex }) => partIndex === 0),
  feature("title case", 1, ({ text }) => /^[A-Z]/.test(text)),
  // "Mumbai, India" on its own is where the company is, not what it is. This
  // was the first real-resume failure: a +2 for "contains a location" let a
  // bare location outscore the company beside it.
  feature("is only a location", -6, ({ text }) => isOnlyLocation(text)),
  feature("contains a role word", -3, ({ text }) => ROLE_WORDS.test(text)),
  feature("very long", -3, ({ text }) => text.length > 70),
];

/** Long, and ends a sentence: a bullet with no marker of any kind. */
function isProse(text: string): boolean {
  return text.length > 40 && /[.!?]["')]?\s*$/.test(text);
}

/** Split "Datadog -- United States (Remote)" into company and location. */
const HEADING_DELIMITER = /\s+(?:--|—|–|\||·|•)\s+|\s{3,}/;

/**
 * Split "Acme Corporation, Austin, TX" into company and location.
 *
 * Only a location at the END of the text is taken. A "City, Country"
 * pattern is loose enough to match "Splunk, Terraform" at the front of a
 * skills line, and stripping that left ", Kubernetes" as a company on the
 * first real run. A company writes its location after its name, never
 * before it.
 */
function extractLocation(text: string): { rest: string; location?: string } {
  // "Lumen Labs, Remote" / "Acme (Hybrid)": a work arrangement is where the
  // job is, for the schema's purposes, and it never matches a city pattern.
  const arrangement = /^(.*?)[\s,]*\(?\b(remote|hybrid|on-?site)\b\)?\s*$/i.exec(text);
  if (arrangement && arrangement[1]!.trim() !== "") {
    return { rest: arrangement[1]!.replace(/[\s,|•·–—-]+$/, "").trim(), location: arrangement[2]! };
  }
  const match = US_LOCATION.exec(text) ?? INTL_LOCATION.exec(text);
  if (!match) return { rest: text };
  const end = match.index + match[0].length;
  if (text.slice(end).trim().replace(/[()]/g, "") !== "") return { rest: text };
  return {
    rest: text.slice(0, match.index).replace(/\s*[|•·,–—-]\s*$/, "").trim(),
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

  // A bullet is a bullet by its glyph, by its indent (recovered upstream),
  // or — in layouts that set bullets as plain paragraphs at the content
  // edge, with neither — by being a sentence. A role, company or date line
  // is a fragment; a bullet is a full stop.
  const isBullet = (line: Line): boolean => isBulletLine(line.text) || isProse(line.text);
  const bullets = lines.filter(isBullet).map((line) => stripBullet(line.text));

  const headingLines = lines.filter((line) => !isBullet(line));

  const range = findDateRange(headingLines);
  if (range) {
    confidence[`${prefix}.startDate`] = 0.9;
    if (range.endDate) confidence[`${prefix}.endDate`] = 0.9;
  }

  // Heading text with the date range removed, then split on delimiters, so a
  // line like "Datadog -- United States | June 2025 - Present" yields two
  // clean candidates rather than one soup.
  const candidates: Candidate[] = [];
  headingLines.forEach((line, lineIndex) => {
    const onDateLine = range !== null && range.lineIndex === lineIndex;
    const text = onDateLine ? stripDateRange(line.text, range.matchedText) : line.text;
    text.split(HEADING_DELIMITER).forEach((part, partIndex) => {
      const trimmed = part.trim();
      if (trimmed !== "") candidates.push({ text: trimmed, lineIndex, partIndex, onDateLine });
    });
  });

  const role = pickBest(candidates, ROLE_FEATURES);
  const companyPool = candidates.filter((candidate) => candidate !== role?.value);
  // "Role / Company / Dates" is the commonest three-line template, so the
  // line right after the role is where the company most often is. Known
  // only once the role is picked, hence a feature built per call.
  const roleLine = role?.value.lineIndex;
  const company = pickBest(companyPool, [
    ...COMPANY_FEATURES,
    feature("follows the role line", 2, ({ lineIndex }) => roleLine !== undefined && lineIndex === roleLine + 1),
  ]);

  let location: string | undefined;
  let companyText = company?.value.text;
  if (companyText) {
    const extracted = extractLocation(companyText);
    location = extracted.location;
    // Only take the remainder if something survived — "Austin, TX" alone on a
    // line is a location, not a company with its location stripped off.
    if (extracted.rest !== "") companyText = extracted.rest;
  }
  if (!location) {
    // A fragment that is nothing but a location, or "United States (Remote)",
    // which no city-pattern matches but is unmistakably a place.
    const bare = candidates.find(
      (candidate) => candidate !== role?.value && candidate !== company?.value && isOnlyLocation(candidate.text),
    );
    if (bare) location = bare.text;
  }

  if (role) confidence[`${prefix}.role`] = role.confidence;
  if (company) confidence[`${prefix}.company`] = company.confidence;
  if (location) confidence[`${prefix}.location`] = 0.75;
  if (bullets.length > 0) confidence[`${prefix}.bullets`] = 0.95;

  return {
    value: {
      company: companyText,
      role: role?.value.text,
      startDate: range?.startDate,
      endDate: range?.endDate,
      current: range?.current,
      location,
      bullets,
    },
    confidence,
  };
}
