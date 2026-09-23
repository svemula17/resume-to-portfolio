/**
 * Name, email, phone, location and links — the preamble block.
 *
 * Everything here is scored against the lines above the first section
 * heading. That region is small and structurally predictable, which is why
 * these fields parse far more reliably than anything inside a section.
 */
import type { Line } from "../../layout";
import type { Basics, Link } from "../../schema/resume";
import { feature, pickBest, type Feature } from "../features";
import {
  clamp01,
  EMAIL,
  INTL_LOCATION,
  PHONE,
  URL,
  US_LOCATION,
} from "../text";

/**
 * The name scoring table from the spec.
 *
 * The negative features do the real work. A name is hard to describe
 * positively — "letters and spaces" also describes a job title, a company and
 * a section heading — but it is easy to describe by what it cannot contain.
 * An @ means the email, a digit means the phone, a comma means the address,
 * a slash means a URL. Four cheap exclusions clear the preamble of everything
 * that is not the name.
 */
export const NAME_FEATURES: Feature<string>[] = [
  feature("letters only", 3, (text) => /^[a-zA-Z\s.'-]+$/.test(text)),
  feature("is all uppercase", 2, (text) => text === text.toUpperCase()),
  feature("two to four words", 2, (text) => {
    const words = text.trim().split(/\s+/);
    return words.length >= 2 && words.length <= 4;
  }),
  feature("contains @", -4, (text) => text.includes("@")),
  feature("contains a digit", -4, (text) => /\d/.test(text)),
  feature("contains a comma", -4, (text) => text.includes(",")),
  feature("contains a slash", -4, (text) => text.includes("/")),
  feature("contains a pipe", -3, (text) => text.includes("|")),
  // A name is short. Anything long is a summary sentence that drifted up.
  feature("longer than 40 chars", -3, (text) => text.length > 40),
];

export interface FieldResult<T> {
  value: T | undefined;
  confidence: number;
}

function found<T>(value: T, confidence: number): FieldResult<T> {
  return { value, confidence };
}

const MISSING: FieldResult<never> = { value: undefined, confidence: 0 };

/**
 * The name.
 *
 * Only the first few preamble lines are considered. On every resume format in
 * existence the name is at the top, and widening the search only adds
 * candidates that can beat it by accident.
 */
export function parseName(preamble: Line[]): FieldResult<string> {
  const candidates = preamble.slice(0, 4).map((line) => line.text.trim()).filter(Boolean);
  const winner = pickBest(candidates, NAME_FEATURES);
  if (!winner) return MISSING;

  // Position is strong evidence that no text feature captures: being the very
  // first line of the document is most of what makes a name a name.
  const positionBonus = candidates.indexOf(winner.value) === 0 ? 0.15 : 0;
  return found(winner.value, clamp01(winner.confidence + positionBonus));
}

/**
 * Contact details are extracted rather than scored.
 *
 * A regex match for an email address either is an email address or is not —
 * there is no competing candidate to rank it against, so scoring would add
 * ceremony without adding information. Confidence reflects how unambiguous
 * the match was instead.
 */
export function parseEmail(lines: Line[]): FieldResult<string> {
  for (const line of lines) {
    const match = EMAIL.exec(line.text);
    if (match) return found(match[0], 0.95);
  }
  return MISSING;
}

export function parsePhone(lines: Line[]): FieldResult<string> {
  for (const line of lines) {
    const match = PHONE.exec(line.text);
    if (!match) continue;
    // A bare run of ten digits is more often an ID or a date smear than a
    // phone number, so an unformatted match is reported less confidently.
    const formatted = /[\s.()-]/.test(match[0]);
    return found(match[0].trim(), formatted ? 0.95 : 0.6);
  }
  return MISSING;
}

export function parseLocation(lines: Line[]): FieldResult<string> {
  for (const line of lines) {
    // "City, ST" is unambiguous. "City, Country" is a looser pattern that can
    // catch a company's address, so it is tried second and trusted less.
    const us = US_LOCATION.exec(line.text);
    if (us) return found(us[0], 0.9);
  }
  for (const line of lines) {
    const intl = INTL_LOCATION.exec(line.text);
    if (intl) return found(intl[0], 0.65);
  }
  return MISSING;
}

/** Hosts worth labelling. Anything else keeps its domain as the label. */
const KNOWN_HOSTS: Array<[RegExp, string]> = [
  [/linkedin\.com/i, "LinkedIn"],
  [/github\.com/i, "GitHub"],
  [/gitlab\.com/i, "GitLab"],
  [/medium\.com/i, "Medium"],
  [/x\.com|twitter\.com/i, "X"],
  [/stackoverflow\.com/i, "Stack Overflow"],
  [/behance\.net/i, "Behance"],
  [/dribbble\.com/i, "Dribbble"],
  [/scholar\.google\./i, "Google Scholar"],
];

function labelFor(url: string): string {
  for (const [pattern, label] of KNOWN_HOSTS) {
    if (pattern.test(url)) return label;
  }
  const host = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0];
  return host ?? url;
}

/**
 * Every URL in the preamble, de-duplicated.
 *
 * Contact lines are usually delimited with pipes or bullets, so the line is
 * split on those first — a single regex sweep across the whole line tends to
 * swallow the delimiter and the next field with it.
 */
export function parseLinks(lines: Line[]): FieldResult<Link[]> {
  const links: Link[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    for (const part of line.text.split(/[|•·]|\s{2,}/)) {
      const match = URL.exec(part.trim());
      if (!match) continue;

      const url = match[0].replace(/[.,;]+$/, "");
      // An email address contains a domain and would otherwise land here.
      if (EMAIL.test(part)) continue;
      // A bare domain with no dot-separated TLD is not a link.
      if (!/\.[a-zA-Z]{2,}/.test(url)) continue;

      const key = url.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ label: labelFor(url), url });
    }
  }

  if (links.length === 0) return MISSING;
  return found(links, 0.85);
}

/**
 * The line under the name: "Senior Software Engineer".
 *
 * Only accepted when it sits directly below the name and carries none of the
 * contact markers. Optional on most resumes, so a miss is cheap and a false
 * positive — promoting the contact line to a job title — is not.
 */
export function parseTitle(preamble: Line[], name: string | undefined): FieldResult<string> {
  if (!name) return MISSING;
  const nameIndex = preamble.findIndex((line) => line.text.trim() === name);
  const candidate = preamble[nameIndex + 1];
  if (nameIndex < 0 || !candidate) return MISSING;

  const text = candidate.text.trim();
  if (text === "") return MISSING;
  if (EMAIL.test(text) || PHONE.test(text) || URL.test(text)) return MISSING;
  if (text.includes("|") || text.includes(",")) return MISSING;
  if (text.length > 60) return MISSING;

  return found(text, 0.7);
}

/** Assemble the whole basics block, with a confidence per field. */
export function parseBasics(preamble: Line[]): {
  basics: Basics;
  confidence: Record<string, number>;
} {
  const name = parseName(preamble);
  const title = parseTitle(preamble, name.value);
  const email = parseEmail(preamble);
  const phone = parsePhone(preamble);
  const location = parseLocation(preamble);
  const links = parseLinks(preamble);

  const confidence: Record<string, number> = {
    "basics.name": name.confidence,
  };
  if (title.value) confidence["basics.title"] = title.confidence;
  if (email.value) confidence["basics.email"] = email.confidence;
  if (phone.value) confidence["basics.phone"] = phone.confidence;
  if (location.value) confidence["basics.location"] = location.confidence;
  if (links.value) confidence["basics.links"] = links.confidence;

  return {
    basics: {
      // The schema requires a name. An empty preamble is a parse failure, not
      // a crash — the review form is where the user supplies what was missed.
      name: name.value ?? "",
      title: title.value,
      email: email.value,
      phone: phone.value,
      location: location.value,
      links: links.value ?? [],
    },
    confidence,
  };
}
