/**
 * Resumes for rendering tests. All three are already in normalised form —
 * what a template actually receives — and none is a real person.
 *
 * HOSTILE is the one that matters. Every string field carries a payload
 * that would execute or break out if it were interpolated raw. A template
 * passes when its output contains none of the markers.
 */
import type { Resume } from "../schema/resume";

export const FULL: Resume = {
  basics: {
    name: "Alex Rivera",
    title: "Security Engineer",
    summary:
      "Security engineer with six years across detection, platform and application security. Builds the tooling, then runs the review.",
    email: "alex@example.com",
    phone: "(415) 555-0142",
    location: "San Francisco, CA",
    links: [
      { label: "GitHub", url: "github.com/arivera" },
      { label: "LinkedIn", url: "https://linkedin.com/in/alex-rivera-sec" },
      { label: "arivera.dev", url: "https://arivera.dev" },
    ],
  },
  experience: [
    {
      company: "Acme Security",
      role: "Staff Security Engineer",
      location: "Remote",
      startDate: "Mar 2022",
      current: true,
      bullets: [
        "Built the detection pipeline that catches credential stuffing in under a minute.",
        "Cut false positives by half by rewriting the scoring model.",
        "Ran the security review programme for forty services.",
      ],
    },
    {
      company: "Initech",
      role: "Platform Engineer",
      location: "Austin, TX",
      startDate: "Jun 2019",
      endDate: "Feb 2022",
      current: false,
      bullets: ["Migrated forty services from VMs to Kubernetes.", "On-call lead for the platform tier."],
    },
  ],
  education: [
    {
      school: "University of Texas at Austin",
      degree: "BS Computer Science",
      startDate: "2015",
      endDate: "2019",
      gpa: "3.8/4.0",
    },
  ],
  projects: [
    {
      name: "Vigil",
      description: "A prompt-injection monitor for LLM agents. Flags indirect injections in tool output.",
      tech: ["Go", "Postgres"],
      url: "github.com/arivera/vigil",
    },
    {
      name: "Sandbox Harness",
      description: "Runs untrusted agent tool calls in a sealed container with a syscall allowlist.",
      tech: ["Rust", "seccomp"],
    },
  ],
  skills: [
    { category: "Languages", items: ["Python", "Go", "Rust", "TypeScript"] },
    { category: "Platform", items: ["Kubernetes", "Terraform", "AWS"] },
    { items: ["Threat modeling", "Incident response"] },
  ],
  certifications: [
    { name: "OSCP", issuer: "OffSec", date: "2021" },
    { name: "AWS Certified Security – Specialty", issuer: "Amazon", date: "2023" },
  ],
};

/** The least a valid resume can be. Every section empty, most fields absent. */
export const SPARSE: Resume = {
  basics: { name: "Jane Doe", links: [] },
  experience: [{ role: "Engineer", bullets: [] }],
  education: [],
  projects: [],
  skills: [],
  certifications: [],
};

export const XSS = `<script>alert(1)</script>`;
export const ATTR = `" onmouseover="alert(2)`;
export const JS_URL = `javascript:alert(3)`;

export const HOSTILE: Resume = {
  basics: {
    name: `${XSS} Name`,
    title: `Title ${ATTR}`,
    summary: `Summary </p><img src=x onerror=alert(4)> & more`,
    email: `a@b.co${XSS}`,
    phone: `555${ATTR}`,
    location: `<b>Bold</b>, XX`,
    links: [
      { label: `Link ${XSS}`, url: JS_URL },
      { label: "Data", url: "data:text/html,<script>alert(5)</script>" },
      { label: "OK", url: "github.com/ok" },
    ],
  },
  experience: [
    {
      company: `Co ${XSS}`,
      role: `Role ${ATTR}`,
      location: `</div>Loc`,
      startDate: `<i>2020</i>`,
      endDate: `</span>2021`,
      current: false,
      bullets: [`Bullet ${XSS}`, `</li></ul><script>alert(6)</script>`],
    },
  ],
  education: [{ school: `School ${XSS}`, degree: `Degree ${ATTR}`, field: `</h3>`, gpa: `<u>4</u>` }],
  projects: [{ name: `Proj ${XSS}`, description: `Desc ${ATTR}`, tech: [`<em>Go</em>`], url: JS_URL }],
  skills: [{ category: `Cat ${XSS}`, items: [`Skill ${ATTR}`, `</li>`] }],
  certifications: [{ name: `Cert ${XSS}`, issuer: `Iss ${ATTR}`, date: `</time>` }],
};

/**
 * Markers that must never appear verbatim in any rendered file. Each one
 * only matches live markup — an unescaped "<" or a real quote — so that
 * the same payload rendered as inert text ("&lt;img … onerror=alert")
 * passes, as it should: the text is still there, it just cannot run.
 */
export const FORBIDDEN_IN_OUTPUT = [
  "<script>alert",
  '" onmouseover="alert',
  "<img src=x onerror",
  'href="javascript:',
  "href='javascript:",
  'href="data:',
  "</p><img",
  "</li></ul><script",
];
