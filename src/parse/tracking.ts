/**
 * Undo letter-spacing that pdf.js turned into spaces.
 *
 * A heading set with tracking — "SUMMARY" at 1.5pt letter-spacing, the
 * house style of every designed template — is extracted as "S U M M A RY":
 * one item, a space between every glyph, and kerned pairs glued together
 * because their advance happened to fall under pdf.js's space threshold.
 * The heading table cannot match that, and a resume whose headings are all
 * tracked parses to nothing.
 *
 * The signature is unmistakable: four or more tokens of one to three
 * characters each, nearly all single. Real text never looks like that.
 * Collapsing the spaces recovers the word; what it cannot recover is a
 * word boundary inside a tracked phrase, since the real space and the
 * letter gaps were flattened to the same character. A short vocabulary of
 * the words tracked phrases are made of — role and section words — puts
 * the common ones back.
 */
import type { Line } from "../layout";

/** Glued kerned pairs are common ("RY", "TA"); a triple is rare but real. */
const TOKEN = /^\S{1,3}$/;
const MIN_TOKENS = 4;
const MIN_SINGLE_SHARE = 0.6;

/** Words a tracked heading or title is likely to contain, longest first. */
const KNOWN_WORDS = [
  "professional", "experience", "employment", "education", "certifications", "certification",
  "publications", "competencies", "technologies", "qualifications", "achievements",
  "summary", "objective", "profile", "contact", "skills", "projects", "awards", "languages",
  "interests", "references", "volunteer", "history", "technical", "core", "work", "about",
  "engineer", "engineering", "developer", "development", "architect", "manager", "director",
  "analyst", "scientist", "designer", "consultant", "specialist", "administrator", "lead",
  "senior", "junior", "staff", "principal", "frontend", "backend", "software", "data",
  "security", "platform", "reliability", "site", "cloud", "product", "and", "of",
].sort((a, b) => b.length - a.length);

export function isTracked(text: string): boolean {
  const tokens = text.trim().split(/\s+/);
  if (tokens.length < MIN_TOKENS) return false;
  if (!tokens.every((token) => TOKEN.test(token))) return false;
  const single = tokens.filter((token) => token.length === 1).length;
  return single / tokens.length >= MIN_SINGLE_SHARE;
}

/**
 * Re-insert word boundaries into a collapsed tracked phrase where a known
 * word is recognisable. "FRONTENDENGINEER" → "FRONTEND ENGINEER";
 * "SUMMARY" → "SUMMARY". Unknown runs are left joined rather than guessed.
 */
function respace(collapsed: string): string {
  const lower = collapsed.toLowerCase();
  const out: string[] = [];
  let i = 0;
  let pending = "";
  while (i < lower.length) {
    const word = KNOWN_WORDS.find((w) => lower.startsWith(w, i));
    if (word && (pending === "" || pending.length >= 2)) {
      if (pending) out.push(pending);
      pending = "";
      out.push(collapsed.slice(i, i + word.length));
      i += word.length;
    } else {
      pending += collapsed[i]!;
      i += 1;
    }
  }
  if (pending) out.push(pending);
  return out.join(" ");
}

export function detrack(text: string): string {
  if (!isTracked(text)) return text;
  return respace(text.replace(/\s+/g, ""));
}

/** Lines with tracked text replaced by their collapsed form. */
export function detrackLines(lines: Line[]): Line[] {
  return lines.map((line) => (isTracked(line.text) ? { ...line, text: detrack(line.text) } : line));
}
