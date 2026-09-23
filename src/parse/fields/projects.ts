/**
 * Projects and certifications. Both are "one heading line plus detail", and
 * both are lighter than experience because there is less to disambiguate.
 */
import type { Line } from "../../layout";
import type { Certification, Project } from "../../schema/resume";
import { DATE_POINT, isBulletLine, stripBullet, URL } from "../text";
import type { ParsedEntry } from "./experience";
import { splitSkillItems } from "./skills";

/** "Tech: React, Node" / "Built with Go" / "(Python, Flask)". */
const TECH_LINE =
  /^(?:tech(?:nologies)?|stack|built with|tools|technologies used)\s*[::]\s*(.+)$/i;
const PAREN_TECH = /\(([A-Za-z0-9+#.\s,/-]{3,80})\)\s*$/;

const HEADING_SPLIT = /\s+(?:--|—|–|\||·|•)\s+/;

export function parseProjectEntry(lines: Line[], index: number): ParsedEntry<Project> {
  const prefix = `projects.${index}`;
  const confidence: Record<string, number> = {};
  if (lines.length === 0) return { value: { tech: [] }, confidence };

  const first = lines[0]!.text.trim();
  let url: string | undefined;
  let tech: string[] = [];
  const descriptionParts: string[] = [];

  // The URL can be anywhere in the entry; the first one is the project's.
  for (const line of lines) {
    const match = URL.exec(line.text);
    if (match && !/@/.test(match[0])) {
      url = match[0].replace(/[.,;)]+$/, "");
      break;
    }
  }

  // The name is the first line, minus any inline tech list or URL, and minus
  // a trailing delimiter-separated description if the template puts one there.
  let name = first.replace(PAREN_TECH, (_, inner: string) => {
    tech = splitSkillItems(inner);
    return "";
  });
  if (url) name = name.replace(url, "");
  const [namePart, ...restOfHeading] = name.split(HEADING_SPLIT);
  name = (namePart ?? "").replace(/[|•·:–—-]+\s*$/, "").trim();
  if (restOfHeading.length > 0) descriptionParts.push(restOfHeading.join(" ").trim());

  for (const line of lines.slice(1)) {
    const text = isBulletLine(line.text) ? stripBullet(line.text) : line.text.trim();
    const techMatch = TECH_LINE.exec(text);
    if (techMatch) {
      tech = [...tech, ...splitSkillItems(techMatch[1]!)];
      continue;
    }
    if (text !== "") descriptionParts.push(text);
  }

  if (name) confidence[`${prefix}.name`] = 0.7;
  if (descriptionParts.length > 0) confidence[`${prefix}.description`] = 0.75;
  if (tech.length > 0) confidence[`${prefix}.tech`] = 0.8;
  if (url) confidence[`${prefix}.url`] = 0.9;

  return {
    value: {
      name: name || undefined,
      description: descriptionParts.length > 0 ? descriptionParts.join(" ") : undefined,
      tech,
      url,
    },
    confidence,
  };
}

/**
 * "AWS Certified Security – Specialty, Amazon, 2023" and its variants.
 *
 * Certifications are almost always one line each, so an entry of several
 * lines is more likely several certifications than one with detail — hence
 * each non-bullet line is parsed on its own.
 */
const ISSUER_HINT = /\b(?:by|from|issued by|through)\s+(.+)$/i;

export function parseCertificationLine(text: string, index: number): ParsedEntry<Certification> {
  const prefix = `certifications.${index}`;
  const confidence: Record<string, number> = {};

  let rest = isBulletLine(text) ? stripBullet(text) : text.trim();

  let date: string | undefined;
  const dateMatch = DATE_POINT.exec(rest);
  if (dateMatch) {
    date = dateMatch[0];
    rest = rest.replace(dateMatch[0], "").trim();
  }

  let issuer: string | undefined;
  const hint = ISSUER_HINT.exec(rest);
  if (hint) {
    issuer = hint[1]!.replace(/[,|•·–—-]+\s*$/, "").trim();
    rest = rest.replace(hint[0], "").trim();
  } else {
    // "Name, Issuer" / "Name – Issuer" / "Name | Issuer": the last delimited
    // part is the issuer when there is more than one part.
    const parts = rest.split(/\s*(?:\||–|—|·|•)\s*|,\s+/).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      issuer = parts[parts.length - 1];
      rest = parts.slice(0, -1).join(", ");
    }
  }

  const name = rest.replace(/[,|•·:–—-]+\s*$/, "").trim() || undefined;

  if (name) confidence[`${prefix}.name`] = 0.75;
  if (issuer) confidence[`${prefix}.issuer`] = hint ? 0.8 : 0.55;
  if (date) confidence[`${prefix}.date`] = 0.85;

  return { value: { name, issuer, date }, confidence };
}
