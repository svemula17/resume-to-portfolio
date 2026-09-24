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
import { findDateRange, stripDateRange } from "./dates";
import type { ParsedEntry } from "./experience";

const DEGREE =
  /\b(b\.?s\.?c?\.?|b\.?a\.?|b\.?tech|b\.?e\.?|m\.?s\.?c?\.?|m\.?a\.?|m\.?tech|m\.?b\.?a\.?|ph\.?d\.?|bachelor(?:'?s)?|master(?:'?s)?|doctorate|associate(?:'?s)?|diploma|certificate)\b/i;

const SCHOOL_WORD =
  /\b(university|college|institute|school|academy|polytechnic|seminary|conservatory)\b/i;

/**
 * "BS in Computer Science" / "Master of Science, Cybersecurity" /
 * "Bachelor of Engineering".
 *
 * Tried in order, because "Master of Science in Cybersecurity" matches all
 * three and only the first gives the right answer. "of" is last: it is the
 * weakest signal, since "Master of Science" names the degree, not the field.
 */
const FIELD_OF_STUDY = [
  /\bin\s+([A-Z][A-Za-z&\s]{2,40})$/,
  /,\s+([A-Z][A-Za-z&\s]{2,40})$/,
  /\bof\s+([A-Z][A-Za-z&\s]{2,40})$/,
];

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

  const range = findDateRange(lines);

  // Dates come off before scoring so "University of Texas, 2013 - 2017" is
  // scored — and recorded — as the school alone.
  const candidates: string[] = [];
  lines.forEach((line, lineIndex) => {
    const text =
      range && range.lineIndex === lineIndex
        ? stripDateRange(line.text, range.matchedText)
        : line.text;
    for (const part of text.split(SPLIT)) {
      const trimmed = part.trim().replace(/[,;]+$/, "");
      if (trimmed === "" || /^(?:expected|graduated|anticipated)$/i.test(trimmed)) continue;
      // "BS Computer Science, San Jose State University": one line, two
      // fields. Split at the comma only when each side is recognisably one
      // of them, so "Columbia University, New York, NY" stays whole.
      const comma = trimmed.indexOf(", ");
      if (comma > 0) {
        const left = trimmed.slice(0, comma);
        const right = trimmed.slice(comma + 2);
        if ((DEGREE.test(left) && SCHOOL_WORD.test(right)) || (SCHOOL_WORD.test(left) && DEGREE.test(right))) {
          candidates.push(left, right);
          continue;
        }
      }
      candidates.push(trimmed);
    }
  });

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
    for (const pattern of FIELD_OF_STUDY) {
      const match = pattern.exec(degree.value);
      if (match) {
        field = match[1]!.trim();
        break;
      }
    }
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
