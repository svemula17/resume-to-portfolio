import { describe, expect, it } from "vitest";
import { entriesOf, linesFromText, parseText } from "./index";
import { mergeWrappedLines } from "./wrap";
import { CONFIDENCE_REVIEW_THRESHOLD } from "../schema/resume";

describe("parseText", () => {
  it("returns a schema-valid resume from an empty string", () => {
    const result = parseText("");
    expect(result.data.basics.name).toBe("Unknown");
    expect(result.confidence["basics.name"]).toBe(0);
  });

  it("returns a schema-valid resume from noise", () => {
    const result = parseText("!!! ??? 123 456\n\n\n---");
    expect(result.data.experience).toEqual([]);
    expect(result.data.skills).toEqual([]);
  });

  it("keys every confidence entry to a real field path", () => {
    const result = parseText(`Jane Doe
jane@example.com

EXPERIENCE
Engineer
Acme Inc. | 2020 - 2021
- Did things.`);

    for (const key of Object.keys(result.confidence)) {
      expect(key).toMatch(/^(basics|experience|education|projects|skills|certifications)\./);
    }
  });

  it("flags a bare unlabelled skills line for review", () => {
    const result = parseText("Jane Doe\n\nSKILLS\nGo, Python");
    expect(result.confidence["skills.0.items"]).toBeLessThan(CONFIDENCE_REVIEW_THRESHOLD);
  });

  it("reads contact details from a Contact section, wherever it sits", () => {
    const result = parseText(`Marcus Adeyemi
Site Reliability Engineer

SUMMARY
SRE with seven years.

CONTACT
marcus.adeyemi@example.com
312-555-0177
Chicago, IL
linkedin.com/in/marcus-adeyemi`);

    expect(result.data.basics.email).toBe("marcus.adeyemi@example.com");
    expect(result.data.basics.phone).toBe("312-555-0177");
    expect(result.data.basics.location).toBe("Chicago, IL");
    expect(result.data.basics.links.map((l) => l.label)).toEqual(["LinkedIn"]);
    expect(result.leftover.map((b) => b.heading)).not.toContain("CONTACT");
  });

  it("treats a one-word label over a list as a skills category, not a section", () => {
    const result = parseText(`Jane Doe
jane@example.com

SKILLS
Languages
TypeScript, JavaScript, CSS
Frameworks
React, Next.js, Vite

EDUCATION
BS Computer Science, San Jose State University`);

    expect(result.data.skills).toEqual([
      { category: "Languages", items: ["TypeScript", "JavaScript", "CSS"] },
      { category: "Frameworks", items: ["React", "Next.js", "Vite"] },
    ]);
    expect(result.data.education[0]!.school).toBe("San Jose State University");
  });

  it("keeps a one-per-line skills list together, acronyms and all", () => {
    const result = parseText(`Jane Doe
jane@example.com

SKILLS
Languages
TypeScript
JavaScript
CSS
Frameworks
React
Vite

EDUCATION
San Jose State University`);

    const items = result.data.skills.flatMap((g) => g.items);
    for (const skill of ["TypeScript", "JavaScript", "CSS", "React", "Vite"]) expect(items).toContain(skill);
    expect(result.data.education[0]!.school).toBe("San Jose State University");
    expect(result.leftover).toEqual([]);
  });

  it("does not mistake PROJECTS above a project line for a skills label", () => {
    const result = parseText(`Jane Doe
jane@example.com

SKILLS
Languages: Go, Python

PROJECTS
Ledger (Go, Postgres) - github.com/janedoe/ledger
An append-only ledger.

CERTIFICATIONS
OSCP | GIAC GCIH`);

    expect(result.data.projects.map((p) => p.name)).toEqual(["Ledger"]);
    expect(result.data.certifications.map((c) => c.name)).toEqual(["OSCP", "GIAC GCIH"]);
  });

  it("does not fold a sidebar heading into the last bullet of the main column", () => {
    // Geometry: the bullet sits at the foot of the left column, the heading
    // at the top of the right one — far to the right and higher up.
    const bullet = { str: "• Maintained the site and its pipeline.", x: 57, y: 700, width: 220, height: 11, fontName: "f", bold: false };
    const heading = { str: "CONTACT", x: 426, y: 80, width: 50, height: 11, fontName: "f", bold: false };
    const lines = [
      { items: [bullet], y: 700, height: 11, isBold: false, x: 57, right: 277, text: bullet.str },
      { items: [heading], y: 80, height: 11, isBold: false, x: 426, right: 476, text: heading.str },
    ];
    expect(mergeWrappedLines(lines).map((l) => l.text)).toEqual([bullet.str, "CONTACT"]);
  });

  it("splits undated projects on title lines after a sentence", () => {
    const result = parseText(`Jane Doe
jane@example.com

PROJECTS
deltacheck (Python, Spark) – github.com/evasquez/deltacheck
Schema drift detection for Delta Lake tables with Slack alerts.
pipeline-lint (Python)
Static checks for Airflow DAGs: cycles, missing retries, unbounded parallelism.`);

    expect(result.data.projects.map((p) => p.name)).toEqual(["deltacheck", "pipeline-lint"]);
  });

  it("does not take a Technologies: line for a project title", () => {
    const result = parseText(`Jane Doe
jane@example.com

PROJECTS
deltacheck github.com/evasquez/deltacheck
Schema drift detection for Delta Lake tables.
Technologies: Python, Spark
pipeline-lint
Static checks for Airflow DAGs.
Technologies: Python`);

    expect(result.data.projects.map((p) => [p.name, p.tech])).toEqual([
      ["deltacheck", ["Python", "Spark"]],
      ["pipeline-lint", ["Python"]],
    ]);
  });

  it("keeps unknown and unparsed sections as leftover text", () => {
    const result = parseText(`Jane Doe

EXPERIENCE
Engineer
Acme Inc. | 2020 - 2021

MY TOOLBOX
Go, Python

VOLUNTEER
Code mentor at a local school`);

    expect(result.leftover).toEqual([
      { heading: "MY TOOLBOX", lines: ["Go, Python"] },
      { heading: "VOLUNTEER", lines: ["Code mentor at a local school"] },
    ]);
  });

  it("keeps paragraph breaks in leftover text so it re-parses into entries", () => {
    const result = parseText(`Jane Doe
jane@example.com
Austin, TX

SIDE WORK
Ledger
An append-only ledger.

Vigil
A prompt-injection monitor.

Spidey
A crawler.`);

    const block = result.leftover[0]!;
    expect(block.lines).toEqual([
      "Ledger",
      "An append-only ledger.",
      "",
      "Vigil",
      "A prompt-injection monitor.",
      "",
      "Spidey",
      "A crawler.",
    ]);

    // The round trip is the property that matters: a block the review form
    // hands back to the parser must split the same way it did the first time.
    const reparsed = entriesOf(linesFromText(block.lines.join("\n")));
    expect(reparsed).toHaveLength(3);
  });

  it("splits education entries with the date on the first line and no gaps", () => {
    // "School | dates / Degree" twice, no blank line between. Gap splitting
    // sees one entry; one-date-per-entry has to find two, and the second
    // entry's degree must not be handed to the first.
    const result = parseText(`Jane Doe
jane@example.com

EDUCATION
Columbia University 2015 – 2017
MS Computer Science, Data Systems
Boston University 2008 – 2012
BS Computer Engineering — GPA 3.7/4.0`);

    expect(result.data.education).toHaveLength(2);
    expect(result.data.education[0]!.degree).toContain("MS Computer Science");
    expect(result.data.education[1]!.school).toContain("Boston University");
    expect(result.data.education[1]!.degree).toContain("BS Computer Engineering");
  });

  it("finds job boundaries on the text path without whitespace between them", () => {
    // No blank lines anywhere: gap-based splitting sees one entry, and the
    // heading-after-bullet fallback has to find the second job.
    const result = parseText(`Jane Doe
EXPERIENCE
Staff Engineer
Acme Inc. | 2021 - Present
- Led things.
Software Engineer
Globex Inc. | 2017 - 2020
- Built things.`);

    expect(result.data.experience).toHaveLength(2);
    expect(result.data.experience[1]!.company).toBe("Globex Inc.");
  });
});
