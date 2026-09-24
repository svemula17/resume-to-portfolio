/**
 * The Canva / Novoresume sidebar resume: a tinted column down the left
 * holding the name, title, contact, skills, education and certifications,
 * and a wider white column on the right for the summary, experience and
 * projects. The most common two-column shape a builder produces, and the
 * one whose text stream most often interleaves the two columns line by
 * line — which is exactly what the layout stage has to undo.
 *
 * The tint is painted on the root element, not on the grid cell, so it
 * repeats on page 2 while the sidebar's content does not. Chrome clips it
 * to the page area, so it stops at the top and bottom margins the way a
 * shaded table cell does in a Word or Google Docs export of the same design.
 */
import type { Resume } from "../../../src/schema/resume";
import { escapeHtml as e } from "../../../src/templates/escape";
import type { Layout } from "../types";

function dates(start?: string, end?: string, current?: boolean): string {
  const to = current ? "Present" : end;
  if (!start && !to) return "";
  return [start, to].filter(Boolean).join(" – ");
}

export const sidebarLeft: Layout = {
  id: "sidebar-left",
  family: "two-column",
  description: "Canva-style tinted left sidebar (name, contact, skills, education, certs) beside a white main column (summary, experience, projects).",
  sectionOrder: ["basics", "skills", "education", "certifications", "summary", "experience", "projects"],
  render(r: Resume): string {
    const b = r.basics;
    const contact = [b.email, b.phone, b.location, ...b.links.map((l) => l.url)].filter(Boolean) as string[];
    return `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: Letter; margin: 0.5in 0; }
html, body { margin: 0; padding: 0; }
html { background: linear-gradient(to right, #e8eef5 0, #e8eef5 32%, #fff 32%, #fff 100%); }
body { font-family: Helvetica, Arial, sans-serif; font-size: 11pt; line-height: 1.45; color: #222; }
.page { display: grid; grid-template-columns: 32% 1fr; column-gap: 18pt; min-height: 10in; }
.side { padding: 0.1in 0.22in 0 0.3in; box-sizing: border-box; font-size: 9.5pt; line-height: 1.3; }
.main { padding: 0.1in 0.55in 0 0; box-sizing: border-box; }
h1 { font-size: 18pt; line-height: 1.1; margin: 0 0 3pt; color: #1b2a41; letter-spacing: 0.3pt; }
.title { font-size: 10.5pt; margin: 0 0 8pt; color: #3c5a80; font-weight: bold; }
h2 { break-after: avoid; font-size: 9.5pt; text-transform: uppercase; letter-spacing: 1.2pt; color: #1b2a41; margin: 16pt 0 6pt; padding-bottom: 2pt; border-bottom: 1.5px solid #1b2a41; }
.side h2 { border-bottom-color: #3c5a80; margin-top: 10pt; }
.side p { margin: 0 0 2pt; font-size: 9.5pt; word-break: break-word; }
.contact p { margin: 0 0 2pt; }
.cat { font-weight: bold; font-size: 9pt; margin: 5pt 0 1pt; color: #3c5a80; }
.side ul { list-style: none; margin: 0 0 3pt; padding: 0; }
.side li { margin: 0; font-size: 9.5pt; }
.edu { margin: 0 0 6pt; }
.edu .school { font-weight: bold; }
.edu .meta { color: #555; font-size: 9pt; }
.cert { margin: 0 0 5pt; }
.cert .meta { color: #555; font-size: 9pt; }
.job { margin: 0 0 14pt; break-inside: avoid; }
.role { font-weight: bold; font-size: 11pt; margin: 0; }
.co { margin: 1pt 0 4pt; color: #444; font-size: 10pt; }
.co .sep { color: #999; margin: 0 4pt; }
ul.bullets { margin: 0; padding-left: 14pt; }
ul.bullets li { margin: 0 0 4pt; }
.proj { margin: 0 0 9pt; break-inside: avoid; }
.proj .name { font-weight: bold; }
.proj .tech { color: #555; font-size: 9pt; }
</style></head><body>
<div class="page">
<div class="side">
<h1>${e(b.name)}</h1>
${b.title ? `<p class="title">${e(b.title)}</p>` : ""}
${contact.length > 0 ? `<h2>Contact</h2><div class="contact">${contact.map((c) => `<p>${e(c)}</p>`).join("")}</div>` : ""}
${
  r.skills.length > 0
    ? `<h2>Skills</h2>${r.skills.map((g) => `<p class="cat">${e(g.category ?? "Other")}</p><ul>${g.items.map((s) => `<li>${e(s)}</li>`).join("")}</ul>`).join("")}`
    : ""
}
${
  r.education.length > 0
    ? `<h2>Education</h2>${r.education
        .map(
          (ed) => `<div class="edu"><p class="school">${e(ed.school ?? "")}</p><p>${e([ed.degree, ed.field].filter(Boolean).join(", "))}</p><p class="meta">${e(dates(ed.startDate, ed.endDate))}${ed.gpa ? ` · GPA ${e(ed.gpa)}` : ""}</p></div>`,
        )
        .join("")}`
    : ""
}
${
  r.certifications.length > 0
    ? `<h2>Certifications</h2>${r.certifications
        .map((c) => `<div class="cert"><p>${e(c.name ?? "")}</p><p class="meta">${e([c.issuer, c.date].filter(Boolean).join(", "))}</p></div>`)
        .join("")}`
    : ""
}
</div>
<div class="main">
${b.summary ? `<h2>Summary</h2><p>${e(b.summary)}</p>` : ""}
${
  r.experience.length > 0
    ? `<h2>Experience</h2>${r.experience
        .map(
          (j) => `<div class="job"><p class="role">${e(j.role ?? "")}</p>
<p class="co">${[j.company, j.location, dates(j.startDate, j.endDate, j.current)]
            .filter(Boolean)
            .map((x) => e(x as string))
            .join(`<span class="sep">·</span>`)}</p>
<ul class="bullets">${j.bullets.map((x) => `<li>${e(x)}</li>`).join("")}</ul></div>`,
        )
        .join("")}`
    : ""
}
${
  r.projects.length > 0
    ? `<h2>Projects</h2>${r.projects
        .map(
          (p) => `<div class="proj"><p><span class="name">${e(p.name ?? "")}</span>${p.tech.length ? ` <span class="tech">(${p.tech.map(e).join(", ")})</span>` : ""}${p.url ? ` <span class="tech">${e(p.url)}</span>` : ""}<br>${e(p.description ?? "")}</p></div>`,
        )
        .join("")}`
    : ""
}
</div>
</div>
</body></html>`;
  },
};
