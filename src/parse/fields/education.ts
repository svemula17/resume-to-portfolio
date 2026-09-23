/**
 * Education.
 *
 * Easier than experience: degrees come from a small closed vocabulary, and a
 * GPA and a year range are both unmistakable. The only genuinely ambiguous
 * call is school-versus-degree when both sit on one line, which the degree
 * vocabulary settles.
 */
import type { Line } from "../../layout";
import type { Education } from "../../schema/resume";
import { feature, pickBest, type Feature } from "../features";
import { GPA, YEAR } from "../text";
import { findDateRange } from "./dates";
import type { ParsedEntry } from "./experience";

const DEGREE =
  /\b(b\.?s\.?c?\.?|b\.?a\.?|b\.?tech|b\.?e\.?|m\.?s\.?c?\.?|m\.?a\.?|m\.?tech|m\.?b\.?a\.?|ph\.?d\.?|bachelor(?:'?s)?|master(?:'?s)?|doctorate|associate(?:'?s)?|diploma|certificate)\b/i;

const SCHOOL_WORD =
  /\b(university|college|institute|school|academy|polytechnic|seminary|conservatory)\b/i;

/** "BS in Computer Science" / "Master of Science, Cybersecurity". */
const FIELD_OF_STUDY = /\b(?:in|of|,)\s+([A-Z][A-Za-z&\s]{2,40})$/;

const DEGREE_FEATURES: Feature<string>[] = [
  feature("contains a degree token", 5, (text) => DEGREE.test(text)),
  feature("contains a school word", -4, (text) => SCHOOL_WORD.test(text)),
  feature("short", 1, (text) => text.length <= 60),
];

const SCHOOL_FEATURES: Feature<string>[] = [
  feature("contains a school word", 5, (text) => SCHOOL_WORD.test(text)),
  feature("contains a degree token", -3, (text) => DEGREE.test(text)),
  feature("title case", 1, (text) => /^[A-Z]/.test(text)),
  feature("is only a GPA", -4, (text) => /^gpa/i.test(text)),
];

const SPLIT = /\s+(?:--|—|–|\||·|•)\s+|\s{3,}/;

export function parseEducationEntry(lines: Line[], index: number): ParsedEntry<Education> {
  const prefix = `education.${index}`;
  const confidence: Record<string, number> = {};

  const candidates: string[] = [];
  for (const line of lines) {
    for (const part of line.text.split(SPLIT)) {
      const trimmed = part.trim();
      if (trimmed !== "") candidates.push(trimmed);
    }
  }

  const degree = pickBest(candidates, DEGREE_FEATURES);
  const school = pickBest(
    candidates.filter((text) => text !== degree?.value),
    SCHOOL_FEATURES,
  );

  // A GPA is only a GPA in the 0-4 range, which is the one cheap defence
  // against matching a version number or a score out of ten.
  let gpa: string | undefined;
  for (const line of lines) {
    if (!/\bgpa|cgpa|grade\b/i.test(line.text)) continue;
    const match = GPA.exec(line.text);
    if (match) {
      gpa = match[2] ? `${match[1]}/${match[2]}` : match[1];
      break;
    }
  }

  const range = findDateRange(lines);
  let startDate = range?.startDate;
  let endDate = range?.endDate;
  if (!range) {
    // A single graduation year with no range is common and worth keeping.
    for (const line of lines) {
      const year = YEAR.exec(line.text);
      if (year) {
        endDate = year[0];
        break;
      }
    }
  }

  let field: string | undefined;
  if (degree?.value) {
    const match = FIELD_OF_STUDY.exec(degree.value);
    if (match) field = match[1]!.trim();
  }

  if (degree) confidence[`${prefix}.degree`] = degree.confidence;
  if (school) confidence[`${prefix}.school`] = school.confidence;
  if (field) confidence[`${prefix}.field`] = 0.7;
  if (gpa) confidence[`${prefix}.gpa`] = 0.9;
  if (startDate) confidence[`${prefix}.startDate`] = 0.85;
  if (endDate) confidence[`${prefix}.endDate`] = range ? 0.85 : 0.6;

  return {
    value: {
      school: school?.value,
      degree: degree?.value,
      field,
      startDate,
      endDate,
      gpa,
    },
    confidence,
  };
}
