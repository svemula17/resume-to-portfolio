/**
 * The timeline rail: a single-column resume where every dated entry is a
 * grid row of [ narrow right-aligned date | vertical rule | content ]. The
 * shape Canva's "minimalist" and many Notion-export templates produce, and
 * the near-miss the layout stage must not mistake for two columns — a wide
 * empty band runs the full height of the page between the dates and the
 * text, but it is one column read row by row, not two read in turn.
 *
 * Name, title and contact are full width at the top; summary and skills are
 * full width too, so only the entry rows carry the rail.
 */
import type { Resume } from "../../../src/schema/resume";
import { escapeHtml as e } from "../../../src/templates/escape";
import type { Layout } from "../types";

/** "Mar 2021 –" over "Present": the dash stays with the start date. */
function dates(start?: string, end?: string, current?: boolean): string {
  const to = current ? "Present" : end;
  if (!start && !to) return "";
  if (!start) return e(to ?? "");
  if (!to) return e(start);
  return `${e(start)} –<br>${e(to)}`;
}

export const timelineRail: Layout = {
  id: "timeline-rail",
  family: "single",
  description: "Timeline single column: dates in a narrow left rail beside a vertical rule, content to the right.",
  sectionOrder: ["basics", "summary", "experience", "education", "skills", "projects", "certifications"],
  render(r: Resume): string {
    const b = r.basics;
    const contact = [b.location, b.phone, b.email, ...b.links.map((l) => l.url)].filter(Boolean).map(e).join("  ·  ");
    return `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: Letter; margin: 0.5in 0.75in; }
body { font-family: Helvetica, Arial, sans-serif; font-size: 10.5pt; line-height: 1.3; color: #1a1a1a; margin: 0; }
h1 { font-size: 22pt; font-weight: bold; margin: 0; letter-spacing: 0.3pt; }
.title { font-size: 11.5pt; color: #444; margin: 2pt 0 4pt; }
.contact { font-size: 9.5pt; color: #333; margin: 0 0 6pt; padding-bottom: 6pt; border-bottom: 1.5px solid #1a1a1a; }
h2 { font-size: 9.5pt; text-transform: uppercase; letter-spacing: 1.5pt; color: #555; margin: 10pt 0 4pt; }
.summary { margin: 0; }
/* One grid per entry, not one per section, so a row never splits across a page. All share the column template, so the rule lines up. */
.entry { display: grid; grid-template-columns: 90pt 1fr; column-gap: 16pt; break-inside: avoid; }
.when { text-align: right; font-size: 9.5pt; color: #555; padding-top: 1pt; }
.what { border-left: 1px solid #999; padding-left: 12pt; padding-bottom: 6pt; }
.role { font-weight: bold; }
.co { color: #333; margin: 0 0 2pt; }
ul { margin: 2pt 0 0; padding-left: 14pt; }
li { margin: 1pt 0; }
.skills p { margin: 2pt 0; }
.proj { margin: 0 0 6pt; }
</style></head><body>
<h1>${e(b.name)}</h1>
${b.title ? `<p class="title">${e(b.title)}</p>` : ""}
<p class="contact">${contact}</p>
${b.summary ? `<h2>Summary</h2><p class="summary">${e(b.summary)}</p>` : ""}
<h2>Experience</h2>
${r.experience
  .map(
    (j) => `<div class="entry"><div class="when">${dates(j.startDate, j.endDate, j.current)}</div>
<div class="what"><div class="role">${e(j.role ?? "")}</div>
<p class="co">${e(j.company ?? "")}${j.location ? ` · ${e(j.location)}` : ""}</p>
<ul>${j.bullets.map((x) => `<li>${e(x)}</li>`).join("")}</ul></div></div>`,
  )
  .join("\n")}
<h2>Education</h2>
${r.education
  .map(
    (ed) => `<div class="entry"><div class="when">${dates(ed.startDate, ed.endDate)}</div>
<div class="what"><div class="role">${e(ed.school ?? "")}</div>
<p class="co">${e([ed.degree, ed.field].filter(Boolean).join(", "))}${ed.gpa ? ` — GPA ${e(ed.gpa)}` : ""}</p></div></div>`,
  )
  .join("\n")}
<h2>Skills</h2>
<div class="skills">${r.skills.map((g) => `<p><b>${e(g.category ?? "Other")}:</b> ${g.items.map(e).join(", ")}</p>`).join("")}</div>
${
  r.projects.length > 0
    ? `<h2>Projects</h2>${r.projects.map((p) => `<p class="proj"><b>${e(p.name ?? "")}</b>${p.tech.length ? ` (${p.tech.map(e).join(", ")})` : ""}${p.url ? ` — ${e(p.url)}` : ""}<br>${e(p.description ?? "")}</p>`).join("")}`
    : ""
}
${
  r.certifications.length > 0
    ? `<h2>Certifications</h2>${r.certifications
        .map(
          (c) => `<div class="entry"><div class="when">${e(c.date ?? "")}</div>
<div class="what"><div class="role">${e(c.name ?? "")}</div>${c.issuer ? `<p class="co">${e(c.issuer)}</p>` : ""}</div></div>`,
        )
        .join("\n")}`
    : ""
}
</body></html>`;
  },
};
