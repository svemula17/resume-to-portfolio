/**
 * The modern dense single column: what a paid builder's "Modern" or
 * "Professional" template produces. Tight 9.5pt type, small-caps section
 * headings over a thin accent rule, and — the part that matters for the
 * parser — each job written company-first: bold company line, the role
 * beneath it, then the dates on their own line with the location, then
 * bullets. Skills are pills, education is "Degree, School" with the years
 * on the right, projects carry a "Technologies:" line.
 */
import type { Resume } from "../../../src/schema/resume";
import { escapeHtml as e } from "../../../src/templates/escape";
import type { Layout } from "../types";

function dates(start?: string, end?: string, current?: boolean): string {
  const to = current ? "Present" : end;
  if (!start && !to) return "";
  return [start, to].filter(Boolean).join(" – ");
}

export const modernDense: Layout = {
  id: "modern-dense",
  family: "single",
  description: "Builder-style dense single column: small-caps headings, company-first jobs with dates on their own line, skill pills.",
  sectionOrder: ["basics", "summary", "experience", "projects", "education", "skills", "certifications"],
  render(r: Resume): string {
    const b = r.basics;
    const contact = [b.email, b.phone, b.location, ...b.links.map((l) => l.url)].filter(Boolean).map(e).join("  ·  ");
    return `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: Letter; margin: 0.55in 0.65in; }
body { font-family: Helvetica, Arial, sans-serif; font-size: 9.5pt; line-height: 1.32; color: #1a1a1a; margin: 0; }
header { border-bottom: 2px solid #2b5c8a; padding-bottom: 6pt; margin-bottom: 8pt; }
h1 { font-size: 19pt; font-weight: bold; margin: 0; letter-spacing: 0.3pt; color: #1a1a1a; }
.title { font-size: 10.5pt; color: #2b5c8a; margin: 1pt 0 3pt; font-weight: bold; }
.contact { font-size: 8.5pt; color: #444; margin: 0; }
h2 { font-size: 10pt; font-variant: small-caps; letter-spacing: 1.2pt; color: #2b5c8a; border-bottom: 1px solid #2b5c8a; margin: 10pt 0 5pt; padding-bottom: 1pt; }
p { margin: 0 0 3pt; }
.job { margin-bottom: 7pt; }
.co { font-weight: bold; font-size: 10pt; margin: 0; }
.role { font-style: italic; margin: 0; }
.when { font-size: 8.5pt; color: #555; margin: 0 0 2pt; }
ul { margin: 1pt 0 0; padding-left: 14pt; }
li { margin: 0 0 1pt; }
.edu { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2pt; }
.edu .deg { font-weight: bold; }
.edu .yrs { font-size: 8.5pt; color: #555; white-space: nowrap; margin-left: 12pt; }
.gpa { font-size: 8.5pt; color: #555; margin: 0 0 3pt; }
.pills { margin: 0 0 4pt; }
.pills .cat { font-weight: bold; font-size: 8.5pt; margin-right: 4pt; }
.pill { display: inline-block; background: #eef3f8; border-radius: 3pt; padding: 1pt 6pt; margin: 1pt 3pt 1pt 0; font-size: 8.5pt; }
.proj { margin-bottom: 5pt; }
.proj .name { font-weight: bold; }
.proj .url { color: #555; font-size: 8.5pt; }
.tech { font-size: 8.5pt; color: #555; margin: 0; }
.cert { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2pt; }
.cert .yr { font-size: 8.5pt; color: #555; white-space: nowrap; margin-left: 12pt; }
</style></head><body>
<header>
<h1>${e(b.name)}</h1>
${b.title ? `<p class="title">${e(b.title)}</p>` : ""}
<p class="contact">${contact}</p>
</header>
${b.summary ? `<h2>Summary</h2><p>${e(b.summary)}</p>` : ""}
${
  r.experience.length > 0
    ? `<h2>Experience</h2>${r.experience
        .map(
          (j) => `<div class="job"><p class="co">${e(j.company ?? "")}</p>
<p class="role">${e(j.role ?? "")}</p>
<p class="when">${[dates(j.startDate, j.endDate, j.current), j.location].filter(Boolean).map(e).join(" · ")}</p>
<ul>${j.bullets.map((x) => `<li>${e(x)}</li>`).join("")}</ul></div>`,
        )
        .join("")}`
    : ""
}
${
  r.projects.length > 0
    ? `<h2>Projects</h2>${r.projects
        .map(
          (p) => `<div class="proj"><p><span class="name">${e(p.name ?? "")}</span>${p.url ? ` <span class="url">${e(p.url)}</span>` : ""}</p>
${p.description ? `<p>${e(p.description)}</p>` : ""}
${p.tech.length ? `<p class="tech">Technologies: ${p.tech.map(e).join(", ")}</p>` : ""}</div>`,
        )
        .join("")}`
    : ""
}
${
  r.education.length > 0
    ? `<h2>Education</h2>${r.education
        .map(
          (ed) => `<div class="edu"><span><span class="deg">${e([ed.degree, ed.field].filter(Boolean).join(" in "))}</span>, ${e(ed.school ?? "")}</span><span class="yrs">${e(dates(ed.startDate, ed.endDate))}</span></div>
${ed.gpa ? `<p class="gpa">GPA ${e(ed.gpa)}</p>` : ""}`,
        )
        .join("")}`
    : ""
}
${
  r.skills.length > 0
    ? `<h2>Skills</h2>${r.skills
        .map(
          (g) => `<div class="pills">${g.category ? `<span class="cat">${e(g.category)}</span>` : ""}${g.items.map((s) => `<span class="pill">${e(s)}</span>`).join("")}</div>`,
        )
        .join("")}`
    : ""
}
${
  r.certifications.length > 0
    ? `<h2>Certifications</h2>${r.certifications
        .map(
          (c) => `<div class="cert"><span>${e(c.name ?? "")}${c.issuer ? ` — ${e(c.issuer)}` : ""}</span>${c.date ? `<span class="yr">${e(c.date)}</span>` : ""}</div>`,
        )
        .join("")}`
    : ""
}
</body></html>`;
  },
};
