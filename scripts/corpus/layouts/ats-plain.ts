/**
 * The deliberately plain ATS-safe resume: the one every "will this get
 * through the screener" guide tells you to write. No rules, no colour, no
 * tables, no columns; everything left-aligned in 11pt serif, headings in
 * plain uppercase text. Each job is Role / Company / dates on their own
 * line / bullets, contact details stack one per line under the name, and
 * skills are "CORE COMPETENCIES" as one comma-separated paragraph per
 * category. Long enough to spill to a second page mid-experience, which is
 * what this template does in the wild.
 */
import type { Resume } from "../../../src/schema/resume";
import { escapeHtml as e } from "../../../src/templates/escape";
import type { Layout } from "../types";

function dates(start?: string, end?: string, current?: boolean): string {
  const to = current ? "Present" : end;
  if (!start && !to) return "";
  return [start, to].filter(Boolean).join(" – ");
}

export const atsPlain: Layout = {
  id: "ats-plain",
  family: "single",
  description: "Plain ATS-safe single column: left-aligned serif, uppercase text headings, no rules or tables, one contact detail per line.",
  sectionOrder: ["basics", "summary", "experience", "education", "skills", "projects", "certifications"],
  render(r: Resume): string {
    const b = r.basics;
    const contact = [b.location, b.phone, b.email, ...b.links.map((l) => l.url)].filter(Boolean) as string[];
    return `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: Letter; margin: 1in; }
body { font-family: Georgia, "Times New Roman", Times, serif; font-size: 11pt; line-height: 1.5; color: #000; margin: 0; }
h1 { font-size: 14pt; font-weight: bold; margin: 0; }
p { margin: 0; }
.contact p { margin: 0; }
h2 { font-size: 11pt; font-weight: bold; text-transform: uppercase; margin: 16pt 0 4pt; break-after: avoid; }
.job { margin: 0 0 10pt; }
.role { font-weight: bold; }
ul { margin: 2pt 0 0; padding-left: 18pt; list-style: disc; }
li { margin: 0; }
.entry { margin: 0 0 6pt; }
</style></head><body>
<h1>${e(b.name)}</h1>
${b.title ? `<p>${e(b.title)}</p>` : ""}
<div class="contact">${contact.map((c) => `<p>${e(c)}</p>`).join("")}</div>
${b.summary ? `<h2>Summary</h2><p>${e(b.summary)}</p>` : ""}
<h2>Professional Experience</h2>
${r.experience
  .map(
    (j) => `<div class="job"><p class="role">${e(j.role ?? "")}</p>
<p>${e(j.company ?? "")}${j.location ? `, ${e(j.location)}` : ""}</p>
<p>${e(dates(j.startDate, j.endDate, j.current))}</p>
<ul>${j.bullets.map((x) => `<li>${e(x)}</li>`).join("")}</ul></div>`,
  )
  .join("")}
<h2>Education</h2>
${r.education
  .map(
    (ed) => `<div class="entry"><p class="role">${e(ed.school ?? "")}</p>
<p>${e([ed.degree, ed.field].filter(Boolean).join(", "))}${ed.gpa ? `, GPA ${e(ed.gpa)}` : ""}</p>
<p>${e(dates(ed.startDate, ed.endDate))}</p></div>`,
  )
  .join("")}
<h2>Core Competencies</h2>
${r.skills.map((g) => `<p>${e(g.category ?? "Other")}: ${g.items.map(e).join(", ")}</p>`).join("")}
${
  r.projects.length > 0
    ? `<h2>Projects</h2>${r.projects.map((p) => `<div class="entry"><p class="role">${e(p.name ?? "")}${p.tech.length ? ` (${p.tech.map(e).join(", ")})` : ""}${p.url ? ` – ${e(p.url)}` : ""}</p><p>${e(p.description ?? "")}</p></div>`).join("")}`
    : ""
}
${
  r.certifications.length > 0
    ? `<h2>Certifications</h2>${r.certifications.map((c) => `<p>${e(c.name ?? "")}${c.issuer ? ` – ${e(c.issuer)}` : ""}${c.date ? ` (${e(c.date)})` : ""}</p>`).join("")}`
    : ""
}
</body></html>`;
  },
};
