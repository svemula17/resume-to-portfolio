/**
 * The classic single-column resume: what Word's default and most ATS-safe
 * templates produce. Centred name, contact line, uppercase section headings
 * with a rule, entries as bold role / company line / bullets, dates on the
 * right of the same line. The reference layout the others are built beside.
 */
import type { Resume } from "../../../src/schema/resume";
import { escapeHtml as e } from "../../../src/templates/escape";
import type { Layout } from "../types";

function dates(start?: string, end?: string, current?: boolean): string {
  const to = current ? "Present" : end;
  if (!start && !to) return "";
  return [start, to].filter(Boolean).join(" – ");
}

export const classic: Layout = {
  id: "classic",
  family: "single",
  description: "Word-style single column: centred header, ruled uppercase headings, dates right-aligned.",
  sectionOrder: ["basics", "summary", "experience", "education", "skills", "projects", "certifications"],
  render(r: Resume): string {
    const b = r.basics;
    const contact = [b.location, b.phone, b.email, ...b.links.map((l) => l.url)].filter(Boolean).map(e).join(" | ");
    return `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: Letter; margin: 0.6in 0.7in; }
body { font-family: Helvetica, Arial, sans-serif; font-size: 10.5pt; line-height: 1.35; color: #111; margin: 0; }
h1 { text-align: center; font-size: 20pt; margin: 0 0 2pt; letter-spacing: 0.5pt; }
.title { text-align: center; font-size: 11pt; margin: 0 0 4pt; color: #333; }
.contact { text-align: center; font-size: 9.5pt; margin: 0 0 10pt; }
h2 { font-size: 10.5pt; text-transform: uppercase; letter-spacing: 1pt; border-bottom: 1px solid #333; margin: 12pt 0 6pt; padding-bottom: 2pt; }
.row { display: flex; justify-content: space-between; align-items: baseline; }
.role { font-weight: bold; }
.co { font-style: italic; margin: 1pt 0 2pt; }
ul { margin: 2pt 0 6pt; padding-left: 16pt; }
li { margin: 1pt 0; }
.skills p { margin: 2pt 0; }
</style></head><body>
<h1>${e(b.name)}</h1>
${b.title ? `<p class="title">${e(b.title)}</p>` : ""}
<p class="contact">${contact}</p>
${b.summary ? `<h2>Summary</h2><p>${e(b.summary)}</p>` : ""}
<h2>Experience</h2>
${r.experience
  .map(
    (j) => `<div class="row"><span class="role">${e(j.role ?? "")}</span><span>${e(dates(j.startDate, j.endDate, j.current))}</span></div>
<p class="co">${e(j.company ?? "")}${j.location ? `, ${e(j.location)}` : ""}</p>
<ul>${j.bullets.map((x) => `<li>${e(x)}</li>`).join("")}</ul>`,
  )
  .join("")}
<h2>Education</h2>
${r.education
  .map(
    (ed) => `<div class="row"><span class="role">${e(ed.school ?? "")}</span><span>${e(dates(ed.startDate, ed.endDate))}</span></div>
<p class="co">${e([ed.degree, ed.field].filter(Boolean).join(", "))}${ed.gpa ? ` — GPA ${e(ed.gpa)}` : ""}</p>`,
  )
  .join("")}
<h2>Skills</h2>
<div class="skills">${r.skills.map((g) => `<p><b>${e(g.category ?? "Other")}:</b> ${g.items.map(e).join(", ")}</p>`).join("")}</div>
${
  r.projects.length > 0
    ? `<h2>Projects</h2>${r.projects.map((p) => `<p><b>${e(p.name ?? "")}</b>${p.tech.length ? ` (${p.tech.map(e).join(", ")})` : ""}${p.url ? ` — ${e(p.url)}` : ""}<br>${e(p.description ?? "")}</p>`).join("")}`
    : ""
}
${
  r.certifications.length > 0
    ? `<h2>Certifications</h2><ul>${r.certifications.map((c) => `<li>${e(c.name ?? "")}${c.issuer ? `, ${e(c.issuer)}` : ""}${c.date ? `, ${e(c.date)}` : ""}</li>`).join("")}</ul>`
    : ""
}
</body></html>`;
  },
};
