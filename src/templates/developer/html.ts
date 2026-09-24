/**
 * Developer: a narrow rail and a wide column. The rail holds who you are —
 * name, title, contact, links, skills — and stays put while the column
 * scrolls through what you have done. On a phone the rail simply comes
 * first. Markup is the same semantic skeleton as Minimal so the page reads
 * top to bottom with no stylesheet at all: identity, then the work.
 */
import type { Resume } from "../../schema/resume";
import type { RenderOptions } from "../types";
import { html, join, type Html } from "../escape";
import {
  contactItems,
  dateSpan,
  dateText,
  document,
  link,
  metaDescription,
  pageTitle,
  presentSections,
  profileLinks,
} from "../parts";

/** A row of small chips. Tech on a project, items in a skill group. */
function tags(items: readonly string[]): Html {
  return html`<ul class="tags" role="list">${items.map((item) => html`<li>${item}</li>`)}</ul>`;
}

function header(resume: Resume): Html {
  const { basics } = resume;
  const contact = contactItems(basics);
  const links = profileLinks(basics.links);
  return html`
<header class="masthead">
  <h1>${basics.name}</h1>
  ${basics.title ? html`<p class="role">${basics.title}</p>` : ""}
  ${contact.length > 0 ? html`<ul class="contact" role="list">${contact.map((item) => html`<li>${item}</li>`)}</ul>` : ""}
  ${links.length > 0 ? html`<ul class="links" role="list">${links.map((item) => html`<li>${item}</li>`)}</ul>` : ""}
</header>`;
}

function skills(resume: Resume): Html {
  const groups = resume.skills.filter((group) => group.items.length > 0);
  return html`
<section id="skills" aria-labelledby="skills-h">
  <h2 id="skills-h">Skills</h2>
  <dl class="skills">
    ${groups.map(
      (group) => html`
    ${group.category ? html`<dt>${group.category}</dt>` : html`<dt class="sr-only">Other</dt>`}
    <dd>${tags(group.items)}</dd>`,
    )}
  </dl>
</section>`;
}

function experience(resume: Resume): Html {
  return html`
<section id="experience" aria-labelledby="experience-h">
  <h2 id="experience-h">Experience</h2>
  ${resume.experience.map(
    (job) => html`
  <article class="entry">
    <div class="entry-head">
      <h3>${job.role ?? job.company ?? "Role"}</h3>
      ${dateSpan(job.startDate, job.endDate, job.current) ? html`<p class="when">${dateSpan(job.startDate, job.endDate, job.current)}</p>` : ""}
    </div>
    ${job.role && job.company ? html`<p class="where">${job.company}${job.location ? html` · ${job.location}` : ""}</p>` : job.location ? html`<p class="where">${job.location}</p>` : ""}
    ${job.bullets.length > 0 ? html`<ul>${job.bullets.map((bullet) => html`<li>${bullet}</li>`)}</ul>` : ""}
  </article>`,
  )}
</section>`;
}

function projects(resume: Resume): Html {
  return html`
<section id="projects" aria-labelledby="projects-h">
  <h2 id="projects-h">Projects</h2>
  ${resume.projects.map(
    (project) => html`
  <article class="entry">
    <div class="entry-head">
      <h3>${project.url ? link(project.name ?? "", project.url) : (project.name ?? "Project")}</h3>
    </div>
    ${project.description ? html`<p>${project.description}</p>` : ""}
    ${project.tech.length > 0 ? tags(project.tech) : ""}
  </article>`,
  )}
</section>`;
}

function education(resume: Resume): Html {
  return html`
<section id="education" aria-labelledby="education-h">
  <h2 id="education-h">Education</h2>
  ${resume.education.map(
    (entry) => html`
  <article class="entry">
    <div class="entry-head">
      <h3>${[entry.degree, entry.field].filter(Boolean).join(", ") || entry.school || "Degree"}</h3>
      ${dateSpan(entry.startDate, entry.endDate) ? html`<p class="when">${dateSpan(entry.startDate, entry.endDate)}</p>` : ""}
    </div>
    ${entry.degree && entry.school ? html`<p class="where">${entry.school}${entry.gpa ? html` · GPA ${entry.gpa}` : ""}</p>` : entry.gpa ? html`<p class="where">GPA ${entry.gpa}</p>` : ""}
  </article>`,
  )}
</section>`;
}

function certifications(resume: Resume): Html {
  return html`
<section id="certifications" aria-labelledby="certifications-h">
  <h2 id="certifications-h">Certifications</h2>
  <ul class="certs" role="list">
    ${resume.certifications.map(
      (cert) => html`
    <li><span class="cert-text"><span class="cert-name">${cert.name ?? "Certification"}</span>${
      cert.issuer ? html` <span class="muted">·&nbsp;${cert.issuer}</span>` : ""
    }</span>${cert.date ? html` ${dateText(cert.date, "when")}` : ""}</li>`,
    )}
  </ul>
</section>`;
}

export function render(resume: Resume, options: RenderOptions = {}): string {
  const has = presentSections(resume);
  const sections: Html[] = [];
  if (has.summary) sections.push(html`<section id="about" aria-label="About"><p class="summary">${resume.basics.summary}</p></section>`);
  if (has.experience) sections.push(experience(resume));
  if (has.projects) sections.push(projects(resume));
  if (has.education) sections.push(education(resume));
  if (has.certifications) sections.push(certifications(resume));

  return document({
    lang: options.lang,
    title: pageTitle(resume),
    description: metaDescription(resume),
    body: html`
<div class="site">
<div class="rail">
${header(resume)}
${has.skills ? skills(resume) : ""}
</div>
<main class="content">
${join(sections, "\n")}
</main>
</div>`,
  });
}
