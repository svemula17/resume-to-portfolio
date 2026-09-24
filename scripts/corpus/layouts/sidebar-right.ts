/**
 * The mirrored sidebar: what Canva's and Novorésumé's "modern" templates
 * produce when the accent panel is on the right. A wide main column on the
 * left carries the name, title, summary, experience and projects; a narrow
 * tinted panel on the right holds contact, skills, education and
 * certifications. The tint bleeds to the page edge and a hairline rule
 * separates the columns, so the panel reads as one block even when the
 * main column runs on to a second page beside an empty sidebar.
 *
 * Built as a CSS grid, which is what a browser-based builder emits: the
 * two columns land in the PDF content stream as two runs of text, and a
 * pipeline that reads by y-position alone will interleave them.
 */
import type { Resume } from "../../../src/schema/resume";
import { escapeHtml as e } from "../../../src/templates/escape";
import type { Layout } from "../types";

function dates(start?: string, end?: string, current?: boolean): string {
  const to = current ? "Present" : end;
  if (!start && !to) return "";
  return [start, to].filter(Boolean).join(" – ");
}

export const sidebarRight: Layout = {
  id: "sidebar-right",
  family: "two-column",
  description: "Canva-style two-column: wide main column left, tinted contact/skills/education sidebar right.",
  sectionOrder: ["basics", "summary", "experience", "projects", "skills", "education", "certifications"],
  render(r: Resume): string {
    const b = r.basics;
    const contact = [b.email, b.phone, b.location, ...b.links.map((l) => l.url)].filter(Boolean) as string[];
    return `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: Letter; margin: 0.5in 0; }
body { font-family: Helvetica, Arial, sans-serif; font-size: 10.5pt; line-height: 1.4; color: #1a1a1a; margin: 0; }
/* The tint is a fixed panel, not the column's background: Chrome repeats
   fixed elements on every printed page, so the panel runs the full height
   of page two even when only the main column has content there — which is
   what the builder templates this imitates do. */
.tint { position: fixed; top: 0; right: 0; bottom: 0; width: 34%; background: #edf1f5; border-left: 1px solid #b8c4d1; z-index: -1; }
.page { display: grid; grid-template-columns: 66fr 34fr; column-gap: 0; }
.main { padding: 0.15in 0.4in 0.3in 0.6in; }
.side { padding: 0.15in 0.45in 0.3in 0.3in; }
.job, .project, .edu, .cert, .group { break-inside: avoid; }
h2 { break-after: avoid; }
h1 { font-size: 22pt; margin: 0 0 2pt; color: #1f3a5f; letter-spacing: 0.3pt; line-height: 1.1; }
.title { font-size: 11.5pt; margin: 0 0 8pt; color: #4a5a6d; text-transform: uppercase; letter-spacing: 1.2pt; }
h2 { font-size: 9.5pt; text-transform: uppercase; letter-spacing: 1.5pt; color: #1f3a5f; margin: 12pt 0 5pt; padding-bottom: 2pt; border-bottom: 2px solid #1f3a5f; }
.side h2 { border-bottom-color: #8a9bb0; }
.main h2:first-of-type { margin-top: 8pt; }
.side h2:first-of-type { margin-top: 0; }
.row { display: flex; justify-content: space-between; align-items: baseline; gap: 8pt; }
.role { font-weight: bold; font-size: 10.5pt; }
.when { font-size: 9pt; color: #555; white-space: nowrap; }
.co { color: #4a5a6d; margin: 0 0 2pt; }
ul { margin: 2pt 0 7pt; padding-left: 14pt; }
li { margin: 1pt 0; }
.summary { margin: 0; }
.project { margin: 0 0 6pt; }
.project .tech { color: #555; font-size: 9pt; }
.contact p { margin: 0 0 3pt; font-size: 9pt; word-break: break-word; }
.group { margin: 0 0 6pt; }
.group b { display: block; font-size: 9pt; color: #4a5a6d; margin-bottom: 1pt; }
.group span { display: inline-block; background: #fff; border: 1px solid #c9d3de; border-radius: 3px; padding: 0 5pt; margin: 1pt 3pt 1pt 0; font-size: 9pt; }
.edu { margin: 0 0 6pt; }
.edu .school { font-weight: bold; }
.edu p { margin: 0; font-size: 9.5pt; }
.cert { margin: 0 0 4pt; font-size: 9.5pt; }
.cert .issuer { color: #555; font-size: 9pt; }
</style></head><body>
<div class="tint"></div>
<div class="page">
<div class="main">
<h1>${e(b.name)}</h1>
${b.title ? `<p class="title">${e(b.title)}</p>` : ""}
${b.summary ? `<h2>Summary</h2><p class="summary">${e(b.summary)}</p>` : ""}
${
  r.experience.length > 0
    ? `<h2>Experience</h2>${r.experience
        .map(
          (j) => `<div class="job"><div class="row"><span class="role">${e(j.role ?? "")}</span><span class="when">${e(dates(j.startDate, j.endDate, j.current))}</span></div>
<p class="co">${e(j.company ?? "")}${j.location ? ` · ${e(j.location)}` : ""}</p>
<ul>${j.bullets.map((x) => `<li>${e(x)}</li>`).join("")}</ul></div>`,
        )
        .join("")}`
    : ""
}
${
  r.projects.length > 0
    ? `<h2>Projects</h2>${r.projects
        .map(
          (p) => `<div class="project"><div class="row"><span class="role">${e(p.name ?? "")}</span>${p.url ? `<span class="when">${e(p.url)}</span>` : ""}</div>
<p class="summary">${e(p.description ?? "")}</p>
${p.tech.length ? `<p class="tech summary">${p.tech.map(e).join(" · ")}</p>` : ""}</div>`,
        )
        .join("")}`
    : ""
}
</div>
<div class="side">
<h2>Contact</h2>
<div class="contact">${contact.map((c) => `<p>${e(c)}</p>`).join("")}</div>
${
  r.skills.length > 0
    ? `<h2>Skills</h2>${r.skills.map((g) => `<div class="group"><b>${e(g.category ?? "Other")}</b>${g.items.map((s) => `<span>${e(s)}</span>`).join("")}</div>`).join("")}`
    : ""
}
${
  r.education.length > 0
    ? `<h2>Education</h2>${r.education
        .map(
          (ed) => `<div class="edu"><p class="school">${e(ed.school ?? "")}</p>
<p>${e([ed.degree, ed.field].filter(Boolean).join(", "))}${ed.gpa ? ` — GPA ${e(ed.gpa)}` : ""}</p>
${dates(ed.startDate, ed.endDate) ? `<p class="when">${e(dates(ed.startDate, ed.endDate))}</p>` : ""}</div>`,
        )
        .join("")}`
    : ""
}
${
  r.certifications.length > 0
    ? `<h2>Certifications</h2>${r.certifications.map((c) => `<div class="cert">${e(c.name ?? "")}${c.issuer || c.date ? `<br><span class="issuer">${[c.issuer, c.date].filter(Boolean).map((x) => e(x as string)).join(", ")}</span>` : ""}</div>`).join("")}`
    : ""
}
</div>
</div>
</body></html>`;
  },
};
