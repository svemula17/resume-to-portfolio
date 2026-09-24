/**
 * Minimal: one column, a header, then sections in the order a reader wants
 * them — what you do, what you have done, what you have built, what you
 * know, where you studied. Markup is semantic and flat so the stylesheet
 * can be short and the page reads well with no stylesheet at all.
 */
import type { Resume } from "../../schema/resume";
import { html, join, type Html } from "../escape";
import {
  contactItems,
  dateSpan,
  document,
  link,
  metaDescription,
  pageTitle,
  presentSections,
  profileLinks,
} from "../parts";

function header(resume: Resume): Html {
  const { basics } = resume;
  const contact = [...contactItems(basics), ...profileLinks(basics.links)];
  return html`
<header class="masthead">
  <h1>${basics.name}</h1>
  ${basics.title ? html`<p class="role">${basics.title}</p>` : ""}
  ${contact.length > 0 ? html`<ul class="contact">${contact.map((item) => html`<li>${item}</li>`)}</ul>` : ""}
</header>`;
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
      ${project.tech.length > 0 ? html`<p class="tech">${project.tech.join(" · ")}</p>` : ""}
    </div>
    ${project.description ? html`<p>${project.description}</p>` : ""}
  </article>`,
  )}
</section>`;
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
    <dd>${group.items.join(", ")}</dd>`,
    )}
  </dl>
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
  <ul class="certs">
    ${resume.certifications.map(
      (cert) => html`
    <li>${cert.name ?? "Certification"}${cert.issuer ? html` <span class="muted">· ${cert.issuer}</span>` : ""}${
      cert.date ? html` <time class="muted">${cert.date}</time>` : ""
    }</li>`,
    )}
  </ul>
</section>`;
}

export function render(resume: Resume): string {
  const has = presentSections(resume);
  const sections: Html[] = [];
  if (has.summary) sections.push(html`<section id="about" aria-label="About"><p class="summary">${resume.basics.summary}</p></section>`);
  if (has.experience) sections.push(experience(resume));
  if (has.projects) sections.push(projects(resume));
  if (has.skills) sections.push(skills(resume));
  if (has.education) sections.push(education(resume));
  if (has.certifications) sections.push(certifications(resume));

  return document({
    title: pageTitle(resume),
    description: metaDescription(resume),
    body: html`
<main class="page">
${header(resume)}
${join(sections, "\n")}
</main>`,
  });
}
