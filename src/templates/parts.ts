/**
 * Small pieces every template renders the same way.
 *
 * A date span, a contact line, a link. Sharing them keeps the three
 * templates honest about the data — a template cannot decide "Present"
 * means something different — while leaving every visual decision to the
 * template. Everything here returns Html built with the tag, so it is
 * safe to interpolate anywhere.
 */
import type { Basics, Link, Resume } from "../schema/resume";
import { displayUrl, html, join, mailto, safeUrl, tel, type Html } from "./escape";

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", sept: "09", oct: "10", nov: "11", dec: "12",
};

/**
 * A machine-readable date for the forms resumes use, or null.
 * "Mar 2022" → 2022-03, "06/2019" → 2019-06, "2019" → 2019. Anything else —
 * "Present", "Spring 2020", "Q3" — is text, and <time> without a real
 * datetime is a lie to assistive tech and search engines alike.
 */
export function isoDate(text: string): string | null {
  const trimmed = text.trim();
  let match = /^([A-Za-z]{3,9})\.?\s+((?:19|20)\d{2})$/.exec(trimmed);
  if (match) {
    const month = MONTHS[match[1]!.toLowerCase().slice(0, 4)] ?? MONTHS[match[1]!.toLowerCase().slice(0, 3)];
    return month ? `${match[2]}-${month}` : null;
  }
  match = /^(\d{1,2})\/((?:19|20)\d{2})$/.exec(trimmed);
  if (match) return `${match[2]}-${match[1]!.padStart(2, "0")}`;
  if (/^(?:19|20)\d{2}$/.test(trimmed)) return trimmed;
  return null;
}

/** A date as <time datetime> when it parses, plain text when it does not. */
export function dateText(text: string, className?: string): Html {
  const iso = isoDate(text);
  const cls = className ? html` class="${className}"` : "";
  return iso ? html`<time datetime="${iso}"${cls}>${text}</time>` : html`<span${cls}>${text}</span>`;
}

/** "Mar 2022 – Present", "2015 – 2019", "2023", or nothing. */
export function dateSpan(start?: string, end?: string, current?: boolean): Html | null {
  const to = current ? "Present" : end;
  if (!start && !to) return null;
  if (start && to) return html`${dateText(start)} – ${dateText(to)}`;
  return dateText(start ?? to ?? "");
}

/** An anchor if the URL is safe, plain text if not. Never a broken link. */
export function link(label: string, url: string | undefined, className?: string): Html {
  const href = safeUrl(url);
  const text = label || (href ? displayUrl(href) : (url ?? ""));
  if (!href) return html`<span${className ? html` class="${className}"` : ""}>${text}</span>`;
  const external = /^https?:/i.test(href);
  return html`<a href="${href}"${className ? html` class="${className}"` : ""}${
    external ? html` rel="noopener"` : ""
  }>${text}</a>`;
}

/** Every link in basics.links, as anchors. */
export function profileLinks(links: readonly Link[], className?: string): Html[] {
  return links.filter((entry) => entry.url).map((entry) => link(entry.label ?? "", entry.url, className));
}

/**
 * Email, phone and location as a list of items: each an anchor where the
 * value validates as one, plain text where it does not.
 */
export function contactItems(basics: Basics): Html[] {
  const items: Html[] = [];
  if (basics.email) {
    const href = mailto(basics.email);
    items.push(href ? html`<a href="${href}">${basics.email}</a>` : html`<span>${basics.email}</span>`);
  }
  if (basics.phone) {
    const href = tel(basics.phone);
    items.push(href ? html`<a href="${href}">${basics.phone}</a>` : html`<span>${basics.phone}</span>`);
  }
  if (basics.location) items.push(html`<span>${basics.location}</span>`);
  return items;
}

/** A page title: "Alex Rivera — Security Engineer". */
export function pageTitle(resume: Resume): string {
  return [resume.basics.name, resume.basics.title].filter(Boolean).join(" — ");
}

/** A meta description from the summary, clipped to a sensible length. */
export function metaDescription(resume: Resume): string | null {
  const summary = resume.basics.summary?.trim();
  if (!summary) return null;
  // By code point, not code unit: slicing a string at 157 can cut an emoji
  // in half and leave a lone surrogate that encodes as U+FFFD.
  const chars = Array.from(summary);
  return chars.length > 160 ? `${chars.slice(0, 157).join("").trimEnd()}…` : summary;
}

/** Which sections have anything to show, in the order templates render them. */
export function presentSections(resume: Resume): {
  summary: boolean;
  experience: boolean;
  projects: boolean;
  skills: boolean;
  education: boolean;
  certifications: boolean;
} {
  return {
    summary: Boolean(resume.basics.summary),
    experience: resume.experience.length > 0,
    projects: resume.projects.length > 0,
    skills: resume.skills.some((group) => group.items.length > 0),
    education: resume.education.length > 0,
    certifications: resume.certifications.length > 0,
  };
}

/** The standard document shell. Templates pass the body and the title. */
export function document(options: {
  title: string;
  description: string | null;
  lang?: string;
  bodyClass?: string;
  body: Html;
}): string {
  return html`<!doctype html>
<html lang="${options.lang ?? "en"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${options.title}</title>
${options.description ? html`<meta name="description" content="${options.description}">` : ""}
<meta name="color-scheme" content="light dark">
<link rel="stylesheet" href="styles.css">
</head>
<body${options.bodyClass ? html` class="${options.bodyClass}"` : ""}>
${options.body}
</body>
</html>
`.__html;
}

export { join };
