/**
 * The header-and-sidebar two-column resume: what Canva, Novoresume and the
 * "modern" Google Docs templates produce. A full-width band across the top
 * with a large name, the title under it and one contact line, then a
 * narrow left column (skills, education, certifications) beside a wide
 * right column (summary, experience, projects). The layout the stage-1
 * tests were designed around: the header genuinely spans both columns,
 * and the columns are a CSS grid, so Chrome's content stream interleaves
 * them the way a real builder's would.
 *
 * Reading order the pipeline is expected to produce: header, then the
 * whole left column top to bottom, then the whole right column.
 */
import type { Resume } from "../../../src/schema/resume";
import { escapeHtml as e } from "../../../src/templates/escape";
import type { Layout } from "../types";

function dates(start?: string, end?: string, current?: boolean): string {
  const to = current ? "Present" : end;
  if (!start && !to) return "";
  return [start, to].filter(Boolean).join(" – ");
}

export const headerTwoColumn: Layout = {
  id: "header-two-column",
  family: "two-column",
  description: "Canva-style: full-width header band, narrow skills/education sidebar on the left, experience on the right.",
  sectionOrder: ["basics", "skills", "education", "certifications", "summary", "experience", "projects"],
  render(r: Resume): string {
    const b = r.basics;
    const contact = [b.email, b.phone, b.location, ...b.links.map((l) => l.url)].filter(Boolean).map(e).join(" • ");
    return `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: Letter; margin: 0.6in 0.65in; }
body { font-family: Helvetica, Arial, sans-serif; font-size: 10.5pt; line-height: 1.45; color: #222; margin: 0; }
.header { background: #1f3a5f; color: #fff; padding: 16pt 18pt 14pt; margin-bottom: 14pt; }
h1 { font-size: 22pt; margin: 0 0 2pt; letter-spacing: 0.5pt; font-weight: bold; }
.title { font-size: 11.5pt; margin: 0 0 6pt; color: #dbe4f0; }
.contact { font-size: 9pt; margin: 0; color: #eef2f7; }
.cols { display: grid; grid-template-columns: 34% 1fr; column-gap: 18pt; align-items: start; }
.left { border-right: 1px solid #c9d2df; padding-right: 12pt; }
h2 { font-size: 10pt; text-transform: uppercase; letter-spacing: 1pt; color: #1f3a5f; border-bottom: 1.5px solid #1f3a5f; margin: 0 0 6pt; padding-bottom: 2pt; break-after: avoid; }
section { margin-bottom: 14pt; }
.row { display: flex; justify-content: space-between; align-items: baseline; gap: 6pt; }
.role { font-weight: bold; }
.when { font-size: 9pt; color: #555; white-space: nowrap; }
.co { font-style: italic; margin: 1pt 0 2pt; color: #444; }
ul { margin: 2pt 0 6pt; padding-left: 14pt; }
li { margin: 1pt 0; }
.left p { margin: 1pt 0 5pt; }
.left .cat { font-weight: bold; display: block; margin-bottom: 1pt; }
.left .school { font-weight: bold; }
.left .sub { color: #444; margin: 0 0 6pt; }
.item { break-inside: avoid; }
</style></head><body>
<div class="header">
<h1>${e(b.name)}</h1>
${b.title ? `<p class="title">${e(b.title)}</p>` : ""}
<p class="contact">${contact}</p>
</div>
<div class="cols">
<div class="left">
${
  r.skills.length > 0
    ? `<section><h2>Skills</h2>${r.skills.map((g) => `<p><span class="cat">${e(g.category ?? "Other")}</span>${g.items.map(e).join(", ")}</p>`).join("")}</section>`
    : ""
}
${
  r.education.length > 0
    ? `<section><h2>Education</h2>${r.education
        .map(
          (ed) => `<div class="item"><p class="school">${e(ed.school ?? "")}</p>
<p class="sub">${e([ed.degree, ed.field].filter(Boolean).join(", "))}${ed.gpa ? `<br>GPA ${e(ed.gpa)}` : ""}<br><span class="when">${e(dates(ed.startDate, ed.endDate))}</span></p></div>`,
        )
        .join("")}</section>`
    : ""
}
${
  r.certifications.length > 0
    ? `<section><h2>Certifications</h2>${r.certifications.map((c) => `<div class="item"><p class="school">${e(c.name ?? "")}</p><p class="sub">${[c.issuer, c.date].filter(Boolean).map((x) => e(x!)).join(", ")}</p></div>`).join("")}</section>`
    : ""
}
</div>
<div class="right">
${b.summary ? `<section><h2>Summary</h2><p>${e(b.summary)}</p></section>` : ""}
${
  r.experience.length > 0
    ? `<section><h2>Experience</h2>${r.experience
        .map(
          (j) => `<div class="item"><div class="row"><span class="role">${e(j.role ?? "")}</span><span class="when">${e(dates(j.startDate, j.endDate, j.current))}</span></div>
<p class="co">${e(j.company ?? "")}${j.location ? `, ${e(j.location)}` : ""}</p>
<ul>${j.bullets.map((x) => `<li>${e(x)}</li>`).join("")}</ul></div>`,
        )
        .join("")}</section>`
    : ""
}
${
  r.projects.length > 0
    ? `<section><h2>Projects</h2>${r.projects.map((p) => `<p class="item"><b>${e(p.name ?? "")}</b>${p.tech.length ? ` (${p.tech.map(e).join(", ")})` : ""}${p.url ? ` — ${e(p.url)}` : ""}<br>${e(p.description ?? "")}</p>`).join("")}</section>`
    : ""
}
</div>
</div>
</body></html>`;
  },
};
