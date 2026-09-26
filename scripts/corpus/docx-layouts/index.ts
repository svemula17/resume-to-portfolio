/**
 * DOCX layouts for the corpus: what Word users actually produce.
 *
 * Three shapes cover most of it. The Word classic — bold role, a tab to a
 * right-aligned date, real bullets from numbering. A two-column built the
 * only way Word can build one: a single-row table with a sidebar cell and
 * a main cell. And the plain document with no list formatting at all,
 * bullets typed as "- " and dates on their own line, which is what a
 * resume pasted from a text editor into Word looks like.
 */
import type { Resume } from "../../../src/schema/resume";
import { paragraph as p, table } from "../docx";
import type { SectionId } from "../types";

export interface DocxLayout {
  id: string;
  family: "single" | "two-column";
  description: string;
  sectionOrder: SectionId[];
  /** The body XML of word/document.xml. */
  render(resume: Resume): string;
}

function dates(start?: string, end?: string, current?: boolean): string {
  const to = current ? "Present" : end;
  return [start, to].filter(Boolean).join(" – ");
}

function heading(text: string): string {
  return p([{ text, bold: true, size: 12 }], { after: 80 });
}

function experience(r: Resume, style: "tab" | "own-line", bullets: "numbered" | "dash"): string[] {
  const out: string[] = [];
  for (const j of r.experience) {
    if (style === "tab") {
      out.push(p([{ text: j.role ?? "", bold: true }, "\t", dates(j.startDate, j.endDate, j.current)], { tabRight: true }));
      out.push(p([{ text: [j.company, j.location].filter(Boolean).join(", "), italic: true }]));
    } else {
      out.push(p([{ text: j.role ?? "", bold: true }]));
      out.push(p([[j.company, j.location].filter(Boolean).join(", ")]));
      out.push(p([dates(j.startDate, j.endDate, j.current)]));
    }
    for (const b of j.bullets) out.push(bullets === "numbered" ? p([b], { bullet: true }) : p([`- ${b}`]));
    out.push(p([""], { after: 120 }));
  }
  return out;
}

function education(r: Resume): string[] {
  return r.education.flatMap((e) => [
    p([{ text: e.school ?? "", bold: true }, "\t", dates(e.startDate, e.endDate)], { tabRight: true }),
    p([[e.degree, e.field].filter(Boolean).join(", ") + (e.gpa ? ` — GPA ${e.gpa}` : "")]),
  ]);
}

function skills(r: Resume): string[] {
  return r.skills.map((g) => p([{ text: `${g.category ?? "Other"}: `, bold: true }, g.items.join(", ")]));
}

function projects(r: Resume): string[] {
  return r.projects.flatMap((pr) => [
    p([{ text: pr.name ?? "", bold: true }, pr.tech.length ? ` (${pr.tech.join(", ")})` : "", pr.url ? ` — ${pr.url}` : ""]),
    p([pr.description ?? ""]),
  ]);
}

function certifications(r: Resume): string[] {
  return r.certifications.map((c) => p([[c.name, c.issuer, c.date].filter(Boolean).join(", ")]));
}

function contactLine(r: Resume): string {
  const b = r.basics;
  return [b.location, b.phone, b.email, ...b.links.map((l) => l.url)].filter(Boolean).join(" | ");
}

export const wordClassic: DocxLayout = {
  id: "docx-classic",
  family: "single",
  description: "Word default: centred name, tab-stopped dates, numbered bullets.",
  sectionOrder: ["basics", "summary", "experience", "education", "skills", "projects", "certifications"],
  render(r) {
    const b = r.basics;
    return [
      p([{ text: b.name, bold: true, size: 18 }], { align: "center" }),
      b.title ? p([b.title], { align: "center" }) : "",
      p([contactLine(r)], { align: "center", after: 200 }),
      b.summary ? heading("SUMMARY") : "",
      b.summary ? p([b.summary], { after: 160 }) : "",
      heading("EXPERIENCE"),
      ...experience(r, "tab", "numbered"),
      heading("EDUCATION"),
      ...education(r),
      heading("SKILLS"),
      ...skills(r),
      r.projects.length ? heading("PROJECTS") : "",
      ...projects(r),
      r.certifications.length ? heading("CERTIFICATIONS") : "",
      ...certifications(r),
    ].join("");
  },
};

export const wordTable: DocxLayout = {
  id: "docx-table",
  family: "two-column",
  description: "Two columns the Word way: one table row, sidebar cell and main cell.",
  sectionOrder: ["basics", "skills", "education", "certifications", "summary", "experience", "projects"],
  render(r) {
    const b = r.basics;
    const sidebar = [
      p([{ text: b.name, bold: true, size: 16 }]),
      b.title ? p([b.title]) : "",
      heading("CONTACT"),
      ...[b.email, b.phone, b.location, ...b.links.map((l) => l.url)].filter((v): v is string => Boolean(v)).map((v) => p([v])),
      heading("SKILLS"),
      ...r.skills.flatMap((g) => [p([{ text: g.category ?? "Other", bold: true }]), ...g.items.map((item) => p([item]))]),
      heading("EDUCATION"),
      ...r.education.flatMap((e) => [p([{ text: e.school ?? "", bold: true }]), p([e.degree ?? ""]), p([dates(e.startDate, e.endDate)])]),
      r.certifications.length ? heading("CERTIFICATIONS") : "",
      ...r.certifications.map((c) => p([c.name ?? ""])),
    ].filter(Boolean);
    const main = [
      b.summary ? heading("SUMMARY") : "",
      b.summary ? p([b.summary], { after: 160 }) : "",
      heading("EXPERIENCE"),
      ...experience(r, "own-line", "numbered"),
      r.projects.length ? heading("PROJECTS") : "",
      ...projects(r),
    ].filter(Boolean);
    return table([[sidebar, main]], [3200, 6160]);
  },
};

export const wordPlain: DocxLayout = {
  id: "docx-plain",
  family: "single",
  description: "Text pasted into Word: no list formatting, dashes for bullets, dates on their own line.",
  sectionOrder: ["basics", "summary", "experience", "education", "skills", "projects", "certifications"],
  render(r) {
    const b = r.basics;
    return [
      p([b.name]),
      b.title ? p([b.title]) : "",
      ...[b.email, b.phone, b.location, ...b.links.map((l) => l.url)].filter((v): v is string => Boolean(v)).map((v) => p([v])),
      p([""]),
      b.summary ? p(["SUMMARY"]) : "",
      b.summary ? p([b.summary]) : "",
      p([""]),
      p(["EXPERIENCE"]),
      ...experience(r, "own-line", "dash"),
      p(["EDUCATION"]),
      ...r.education.flatMap((e) => [p([e.school ?? ""]), p([[e.degree, e.field].filter(Boolean).join(", ")]), p([dates(e.startDate, e.endDate)]), p([""])]),
      p(["SKILLS"]),
      ...r.skills.map((g) => p([`${g.category ?? "Other"}: ${g.items.join(", ")}`])),
      p([""]),
      r.projects.length ? p(["PROJECTS"]) : "",
      ...r.projects.flatMap((pr) => [p([pr.name ?? ""]), p([pr.description ?? ""]), pr.tech.length ? p([`Technologies: ${pr.tech.join(", ")}`]) : "", p([""])]),
      r.certifications.length ? p(["CERTIFICATIONS"]) : "",
      ...r.certifications.map((c) => p([[c.name, c.issuer, c.date].filter(Boolean).join(" - ")])),
    ].join("");
  },
};

export const DOCX_LAYOUTS: DocxLayout[] = [wordClassic, wordTable, wordPlain];
