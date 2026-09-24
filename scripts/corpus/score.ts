/**
 * Score the corpus: run the real pipeline over every PDF and compare to
 * the truth it was rendered from.
 *
 *   npx tsx scripts/corpus/score.ts             # scoreboard to stdout + SCOREBOARD.md
 *   npx tsx scripts/corpus/score.ts --verbose   # every miss, per entry
 *
 * Two numbers per entry, because they fail for different reasons.
 *
 * Reading order is the stage-1 question: did the layout stage put the text
 * in the order a human reads it? It is scored on the truth's text units —
 * name, title, each job's role and bullets, and so on, in the order the
 * layout says a reader meets them — as the fraction of consecutive units
 * that appear in that order in the reconstructed text. 1.0 means every
 * unit was found and none swapped places.
 *
 * Fields is the stage-2 question: given that text, did the parser fill the
 * schema correctly? It is the fraction of truth fields the parsed resume
 * got right, after the same normalisation the review form applies.
 *
 * The build plan's gate is on reading order: single-column ≥ 90%,
 * two-column ≥ 60%.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { toReadingOrder } from "../../src/layout/index";
import { parseLines } from "../../src/parse/index";
import type { Page, TextItem } from "../../src/extract/types";
import type { Resume } from "../../src/schema/resume";
import type { CorpusEntry, SectionId } from "./types";

const DIR = join(import.meta.dirname, "..", "..", "fixtures", "corpus");
const verbose = process.argv.includes("--verbose");

const BOLD = /bold|semibold|demibold|demi|black|heavy|[-_,]bd\b/i;

/** The same extraction pdf.ts does, on the legacy build node can load. */
async function extract(path: string): Promise<Page[]> {
  const loadingTask = getDocument({ data: new Uint8Array(readFileSync(path)) });
  const document = await loadingTask.promise;
  const pages: Page[] = [];
  for (let n = 1; n <= document.numPages; n += 1) {
    const page = await document.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: TextItem[] = [];
    for (const raw of content.items) {
      if (!("str" in raw) || raw.str.trim() === "") continue;
      const family = content.styles[raw.fontName]?.fontFamily ?? "";
      items.push({
        str: raw.str,
        x: Number(raw.transform[4]),
        y: viewport.height - Number(raw.transform[5]),
        width: raw.width,
        height: raw.height,
        fontName: raw.fontName,
        bold: BOLD.test(raw.fontName) || BOLD.test(family),
      });
    }
    pages.push({ pageNumber: n, width: viewport.width, height: viewport.height, items, imageOnly: items.length === 0 });
  }
  // destroy() is on the loading task, not the document proxy.
  await loadingTask.destroy();
  return pages;
}

function norm(text: string | undefined): string {
  return (text ?? "")
    .toLowerCase()
    .replace(/[–—−]/g, "-")
    .replace(/[^a-z0-9+#./@ -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Text units in reading order, per the layout's section order. */
function units(truth: Resume, order: SectionId[]): string[] {
  const out: string[] = [];
  for (const section of order) {
    switch (section) {
      case "basics":
        out.push(truth.basics.name);
        if (truth.basics.title) out.push(truth.basics.title);
        break;
      case "summary":
        if (truth.basics.summary) out.push(truth.basics.summary);
        break;
      case "experience":
        for (const job of truth.experience) {
          if (job.role) out.push(job.role);
          if (job.company) out.push(job.company);
          out.push(...job.bullets);
        }
        break;
      case "education":
        for (const e of truth.education) {
          if (e.school) out.push(e.school);
          if (e.degree) out.push(e.degree);
        }
        break;
      case "skills":
        for (const group of truth.skills) out.push(...group.items);
        break;
      case "projects":
        for (const p of truth.projects) {
          if (p.name) out.push(p.name);
          if (p.description) out.push(p.description);
        }
        break;
      case "certifications":
        for (const c of truth.certifications) if (c.name) out.push(c.name);
        break;
    }
  }
  return out;
}

/**
 * Fraction of consecutive truth units found in order.
 *
 * The scan is sequential: each unit is searched for from where the last
 * one was found, not from the top. "Kubernetes" appears in a job bullet
 * long before the skills section, and a first-occurrence search would call
 * the skills list swapped when it is exactly where it should be. A unit
 * not found after the cursor is looked for anywhere; found earlier, it is
 * a genuine swap, and not found at all, it is missing.
 *
 * A unit that wraps across lines is still one unit in the text — lines are
 * joined with a space — so a long bullet is one hit or one miss.
 */
function readingOrderScore(text: string, truthUnits: string[]): { score: number; misses: string[] } {
  const haystack = norm(text);
  const misses: string[] = [];
  let cursor = 0;
  let ordered = 0;
  let pairs = 0;
  let previousFound = true;

  truthUnits.forEach((unit, i) => {
    const needle = norm(unit);
    const ahead = haystack.indexOf(needle, cursor);
    const found = ahead >= 0 ? ahead : haystack.indexOf(needle);
    const inOrder = ahead >= 0;
    if (i > 0) {
      pairs += 1;
      if (inOrder && previousFound) ordered += 1;
      else {
        const why = found < 0 ? "missing" : !previousFound ? "prev missing" : "swapped";
        misses.push(`${truthUnits[i - 1]!.slice(0, 30)} → ${unit.slice(0, 30)} (${why})`);
      }
    }
    if (found >= 0) cursor = found + needle.length;
    previousFound = found >= 0;
  });

  return { score: pairs === 0 ? 1 : ordered / pairs, misses };
}

interface FieldTally {
  right: number;
  total: number;
  misses: string[];
}

function tally(t: FieldTally, name: string, ok: boolean, detail = ""): void {
  t.total += 1;
  if (ok) t.right += 1;
  else t.misses.push(detail ? `${name}: ${detail}` : name);
}

function same(a: string | undefined, b: string | undefined): boolean {
  return norm(a) === norm(b);
}

function contains(a: string | undefined, b: string | undefined): boolean {
  return norm(a).includes(norm(b)) && norm(b) !== "";
}

/** Field accuracy against the truth, entry by entry, best match by role/company. */
function fieldScore(parsed: Resume, truth: Resume): FieldTally {
  const t: FieldTally = { right: 0, total: 0, misses: [] };

  tally(t, "name", same(parsed.basics.name, truth.basics.name), `got ${JSON.stringify(parsed.basics.name)}`);
  if (truth.basics.email) tally(t, "email", same(parsed.basics.email, truth.basics.email), `got ${parsed.basics.email}`);
  if (truth.basics.phone) tally(t, "phone", norm(parsed.basics.phone).replace(/\D/g, "") === norm(truth.basics.phone).replace(/\D/g, ""), `got ${parsed.basics.phone}`);
  if (truth.basics.location) tally(t, "location", same(parsed.basics.location, truth.basics.location), `got ${parsed.basics.location}`);
  if (truth.basics.summary) tally(t, "summary", contains(parsed.basics.summary, truth.basics.summary.slice(0, 40)), `got ${(parsed.basics.summary ?? "").slice(0, 40)}`);
  for (const link of truth.basics.links) {
    tally(t, `link ${link.label}`, parsed.basics.links.some((l) => contains(l.url, link.url)));
  }

  for (const job of truth.experience) {
    const match =
      parsed.experience.find((p) => same(p.company, job.company) && same(p.role, job.role)) ??
      parsed.experience.find((p) => same(p.company, job.company) || same(p.role, job.role));
    const tag = `job ${job.company}`;
    if (!match) {
      tally(t, `${tag} found`, false, "no parsed job matched");
      continue;
    }
    tally(t, `${tag} found`, true);
    tally(t, `${tag} role`, same(match.role, job.role), `got ${match.role}`);
    tally(t, `${tag} company`, same(match.company, job.company), `got ${match.company}`);
    tally(t, `${tag} start`, same(match.startDate, job.startDate), `got ${match.startDate}`);
    tally(t, `${tag} end`, job.current ? match.current === true : same(match.endDate, job.endDate), `got ${job.current ? match.current : match.endDate}`);
    const found = job.bullets.filter((b) => match.bullets.some((pb) => contains(pb, b.slice(0, 40)))).length;
    tally(t, `${tag} bullets`, found === job.bullets.length, `${found}/${job.bullets.length}`);
  }
  tally(t, "job count", parsed.experience.length === truth.experience.length, `got ${parsed.experience.length}, want ${truth.experience.length}`);

  for (const e of truth.education) {
    const match = parsed.education.find((p) => contains(p.school, e.school) || contains(p.degree, e.degree));
    const tag = `edu ${e.school}`;
    tally(t, `${tag} found`, Boolean(match));
    if (match) {
      tally(t, `${tag} school`, contains(match.school, e.school), `got ${match.school}`);
      tally(t, `${tag} degree`, contains(match.degree, e.degree), `got ${match.degree}`);
    }
  }

  const truthSkills = truth.skills.flatMap((g) => g.items);
  const parsedSkills = parsed.skills.flatMap((g) => g.items);
  const skillHits = truthSkills.filter((s) => parsedSkills.some((p) => same(p, s))).length;
  if (truthSkills.length > 0) tally(t, "skills", skillHits === truthSkills.length, `${skillHits}/${truthSkills.length}`);

  for (const p of truth.projects) tally(t, `project ${p.name}`, parsed.projects.some((pp) => contains(pp.name, p.name)));
  for (const c of truth.certifications) tally(t, `cert ${c.name}`, parsed.certifications.some((pc) => contains(pc.name, c.name!.slice(0, 20))));

  return t;
}

interface Row {
  id: string;
  family: string;
  layout: string;
  person: string;
  pages: number;
  layoutsDetected: string;
  order: number;
  fields: number;
  orderMisses: string[];
  fieldMisses: string[];
}

const entries = readdirSync(DIR)
  .filter((f) => f.endsWith(".truth.json"))
  .map((f) => JSON.parse(readFileSync(join(DIR, f), "utf8")) as CorpusEntry)
  .sort((a, b) => a.id.localeCompare(b.id));

if (entries.length === 0) {
  console.error(`No corpus in ${DIR}. Run: npx tsx scripts/corpus/build.ts`);
  process.exit(1);
}

const rows: Row[] = [];
for (const entry of entries) {
  const pages = await extract(join(DIR, `${entry.id}.pdf`));
  const lines = toReadingOrder(pages);
  const text = lines.map((line) => line.text).join("\n");
  const parsed = parseLines(lines).data;
  const order = readingOrderScore(text, units(entry.truth, entry.sectionOrder));
  const fields = fieldScore(parsed, entry.truth);
  const { toPageReadingOrders } = await import("../../src/layout/index");
  const detected = toPageReadingOrders(pages).map((p) => (p.layout.type === "single" ? "1" : "2")).join("");
  rows.push({
    id: entry.id,
    family: entry.family,
    layout: entry.layout,
    person: entry.person,
    pages: pages.length,
    layoutsDetected: detected,
    order: order.score,
    fields: fields.total === 0 ? 1 : fields.right / fields.total,
    orderMisses: order.misses,
    fieldMisses: fields.misses,
  });
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const avg = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

const lines: string[] = [];
lines.push("# Corpus scoreboard", "");
lines.push("Generated by `npm run corpus:score`. Reading order is the stage-1 gate; fields is the parser.", "");
lines.push("| Entry | Family | Pages | Detected | Reading order | Fields |", "| --- | --- | --- | --- | --- | --- |");
for (const r of rows) lines.push(`| ${r.id} | ${r.family} | ${r.pages} | ${r.layoutsDetected} | ${pct(r.order)} | ${pct(r.fields)} |`);
lines.push("");
for (const family of ["single", "two-column"] as const) {
  const fam = rows.filter((r) => r.family === family);
  if (fam.length === 0) continue;
  const gate = family === "single" ? 0.9 : 0.6;
  const o = avg(fam.map((r) => r.order));
  const f = avg(fam.map((r) => r.fields));
  lines.push(`**${family}** (${fam.length}): reading order ${pct(o)} (gate ${pct(gate)}: ${o >= gate ? "PASS" : "FAIL"}), fields ${pct(f)}`);
}
lines.push("");
const worst = [...rows].sort((a, b) => a.order - b.order).slice(0, 3);
lines.push("Worst reading order: " + worst.map((r) => `${r.id} (${pct(r.order)})`).join(", "));

const report = lines.join("\n");
console.log(report);
writeFileSync(join(DIR, "SCOREBOARD.md"), `${report}\n`);

if (verbose) {
  for (const r of rows) {
    if (r.orderMisses.length === 0 && r.fieldMisses.length === 0) continue;
    console.log(`\n== ${r.id} ==`);
    for (const m of r.orderMisses) console.log(`  order: ${m}`);
    for (const m of r.fieldMisses) console.log(`  field: ${m}`);
  }
}
