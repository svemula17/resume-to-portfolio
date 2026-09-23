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
  // The URL comes off first: "Ledger (Go, Postgres) - github.com/x/ledger"
  // only has its tech list at the end once the link is gone.
  let name = url ? first.replace(url, "") : first;
  name = name.replace(/\s*[|•·:–—-]+\s*$/, "");
  name = name.replace(PAREN_TECH, (_, inner: string) => {
    tech = splitSkillItems(inner);
    return "";
  });
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
 * Certifications.
 *
 * Two shapes cover it. One per line — "AWS Certified Security – Specialty,
 * Amazon, 2023" — where the last delimited part is the issuer. And several
 * per line — "CompTIA Security+ (Active), CompTIA CySA+ (In Progress)" —
 * where every comma-separated part that names a vendor is its own entry.
 * The second shape is detected first, because treating it as the first
 * turns three certifications into one with a nonsense issuer.
 */
const ISSUER_HINT = /\b(?:by|from|issued by|through)\s+(.+)$/i;

/** Vendors that appear at the front of a certification name. */
const VENDOR =
  /^(CompTIA|AWS|Amazon|Microsoft|Azure|Google|GCP|Cisco|ISC2|\(ISC\)²|GIAC|SANS|Oracle|Red Hat|HashiCorp|Kubernetes|CNCF|Linux Foundation|Salesforce|PMI|ISACA|EC-Council|Offensive Security|OffSec)\b/i;

const LOOKS_LIKE_CERT = /certified|certificate|\+|\b(?:CISSP|CISM|CISA|CCNA|CCNP|OSCP|CEH|PMP|CKA|CKAD)\b/i;

function parseOne(text: string, index: number): ParsedEntry<Certification> {
  const prefix = `certifications.${index}`;
  const confidence: Record<string, number> = {};
  let rest = text.trim();

  let date: string | undefined;
  const dateMatch = DATE_POINT.exec(rest);
  if (dateMatch) {
    date = dateMatch[0];
    // Removing "2022" from "Name, Amazon, 2022" leaves a dangling comma that
    // would otherwise end up inside the issuer.
    rest = rest.replace(dateMatch[0], "").replace(/[\s,|•·–—-]+$/, "").trim();
  }

  let issuer: string | undefined;
  let issuerConfidence = 0;
  const hint = ISSUER_HINT.exec(rest);
  if (hint) {
    issuer = hint[1]!.replace(/[,|•·–—-]+\s*$/, "").trim();
    rest = rest.replace(hint[0], "").trim();
    issuerConfidence = 0.8;
  } else {
    // Pipes and commas separate name from issuer. Dashes do not: they live
    // inside names — "Solutions Architect – Associate" — far more often than
    // between fields.
    const parts = rest
      .split(/\s*[|·•]\s*|,\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      issuer = parts[parts.length - 1];
      rest = parts.slice(0, -1).join(", ");
      issuerConfidence = 0.55;
    } else {
      const vendor = VENDOR.exec(rest);
      if (vendor) {
        issuer = vendor[1];
        issuerConfidence = 0.7;
      }
    }
  }

  const name = rest.replace(/[,|•·:–—-]+\s*$/, "").trim() || undefined;

  if (name) confidence[`${prefix}.name`] = 0.75;
  if (issuer) confidence[`${prefix}.issuer`] = issuerConfidence;
  if (date) confidence[`${prefix}.date`] = 0.85;

  return { value: { name, issuer, date }, confidence };
}

/** Parse a line that may hold one certification or several. */
export function parseCertificationLine(
  text: string,
  startIndex: number,
): Array<ParsedEntry<Certification>> {
  const clean = isBulletLine(text) ? stripBullet(text) : text.trim();

  // Several on one line: split on commas, pipes or bullets that sit outside
  // parentheses, and take that reading only if at least two parts
  // independently look like a certification. One part looking like one is
  // just a name with a comma in it.
  // Pipes are never "name, issuer, date" separators, so two pipe-separated
  // parts are two certifications. Commas are ambiguous — "Name, Amazon,
  // 2022" is one — so the comma reading needs two parts that each look like
  // a certification by themselves, and a bare vendor name does not count.
  const byPipe = clean.split(/\s*[|•·]\s*(?![^(]*\))/).map((part) => part.trim()).filter(Boolean);
  if (byPipe.length >= 2) {
    return byPipe.map((part, offset) => parseOne(part, startIndex + offset));
  }

  const byComma = clean.split(/,\s+(?![^(]*\))/).map((part) => part.trim()).filter(Boolean);
  const certLike = byComma.filter((part) => LOOKS_LIKE_CERT.test(part));
  if (byComma.length >= 2 && certLike.length >= 2) {
    return byComma.map((part, offset) => parseOne(part, startIndex + offset));
  }

  return [parseOne(clean, startIndex)];
}
