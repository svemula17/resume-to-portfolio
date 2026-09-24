/**
 * Creative: editorial, but still a resume. A tinted band carries the name
 * at display size and the summary as a lede; below it the sections run in
 * the usual order under numbered headings. Experience is a timeline,
 * projects a card grid, skills pill groups. The markup stays semantic and
 * flat — the numbers, the dots and the grid are all stylesheet work, so
 * the page reads as a plain document with no stylesheet at all.
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

function header(resume: Resume): Html {
  const { basics } = resume;
  const contact = contactItems(basics);
  const profiles = profileLinks(basics.links);
  return html`
<header class="masthead">
  <div class="wrap">
    ${basics.title ? html`<p class="role">${basics.title}</p>` : ""}
    <h1>${basics.name}</h1>
    ${basics.summary ? html`<p class="lede">${basics.summary}</p>` : ""}
    ${contact.length > 0 ? html`<ul class="contact" role="list">${contact.map((item) => html`<li>${item}</li>`)}</ul>` : ""}
    ${profiles.length > 0 ? html`<ul class="profiles" role="list">${profiles.map((item) => html`<li>${item}</li>`)}</ul>` : ""}
  </div>
</header>`;
}

function experience(resume: Resume): Html {
  return html`
<section id="experience" aria-labelledby="experience-h">
  <h2 id="experience-h">Experience</h2>
  <ol class="timeline${resume.experience.some((job) => dateSpan(job.startDate, job.endDate, job.current)) ? " dated" : ""}" role="list">
    ${resume.experience.map(
      (job) => html`
    <li>
      <article class="entry">
        ${dateSpan(job.startDate, job.endDate, job.current) ? html`<p class="when">${dateSpan(job.startDate, job.endDate, job.current)}</p>` : ""}
        <h3>${job.role ?? job.company ?? "Role"}</h3>
        ${job.role && job.company ? html`<p class="where">${job.company}${job.location ? html`&nbsp;<span class="sep">·</span> ${job.location}` : ""}</p>` : job.location ? html`<p class="where">${job.location}</p>` : ""}
        ${job.bullets.length > 0 ? html`<ul>${job.bullets.map((bullet) => html`<li>${bullet}</li>`)}</ul>` : ""}
      </article>
    </li>`,
    )}
  </ol>
</section>`;
}

function projects(resume: Resume): Html {
  return html`
<section id="projects" aria-labelledby="projects-h">
  <h2 id="projects-h">Projects</h2>
  <div class="cards">
    ${resume.projects.map(
      (project) => html`
    <article class="card">
      <h3>${project.url ? link(project.name ?? "", project.url) : (project.name ?? "Project")}</h3>
      ${project.description ? html`<p>${project.description}</p>` : ""}
      ${project.tech.length > 0 ? html`<ul class="tags" role="list">${project.tech.map((tag) => html`<li>${tag}</li>`)}</ul>` : ""}
    </article>`,
    )}
  </div>
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
    <div class="skill-group">
      ${group.category ? html`<dt>${group.category}</dt>` : html`<dt class="sr-only">Other</dt>`}
      <dd><ul class="pills" role="list">${group.items.map((item) => html`<li>${item}</li>`)}</ul></dd>
    </div>`,
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
  <article class="entry plain">
    <div class="entry-head">
      <h3>${[entry.degree, entry.field].filter(Boolean).join(", ") || entry.school || "Degree"}</h3>
      ${dateSpan(entry.startDate, entry.endDate) ? html`<p class="when">${dateSpan(entry.startDate, entry.endDate)}</p>` : ""}
    </div>
    ${entry.degree && entry.school ? html`<p class="where">${entry.school}${entry.gpa ? html`&nbsp;<span class="sep">·</span> GPA ${entry.gpa}` : ""}</p>` : entry.gpa ? html`<p class="where">GPA ${entry.gpa}</p>` : ""}
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
    <li>
      <span class="cert-name">${cert.name ?? "Certification"}</span>${cert.issuer ? html`&nbsp;<span class="sep">·</span> <span class="muted">${cert.issuer}</span>` : ""}${
        cert.date ? html` ${dateText(cert.date, "muted")}` : ""
      }
    </li>`,
    )}
  </ul>
</section>`;
}

export function render(resume: Resume, options: RenderOptions = {}): string {
  const has = presentSections(resume);
  const sections: Html[] = [];
  // The summary is the lede in the masthead, so it is not a section here.
  if (has.experience) sections.push(experience(resume));
  if (has.projects) sections.push(projects(resume));
  if (has.skills) sections.push(skills(resume));
  if (has.education) sections.push(education(resume));
  if (has.certifications) sections.push(certifications(resume));

  return document({
    lang: options.lang,
    title: pageTitle(resume),
    description: metaDescription(resume),
    body: html`
${header(resume)}
<main class="wrap">
${join(sections, "\n")}
</main>`,
  });
}
