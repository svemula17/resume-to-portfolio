/**
 * Every template, through the same gauntlet.
 *
 * The hostile fixture is the one that matters: a template passes when its
 * output contains none of the payload markers, and fails the moment one
 * interpolation bypasses the html tag. The snapshots are the regression
 * net the build plan asks for — "snapshot-test template output so escaping
 * regressions surface immediately".
 */
import { describe, expect, it } from "vitest";
import { normalise } from "../ui/review/export";
import { FORBIDDEN_IN_OUTPUT, FULL, HOSTILE, SPARSE } from "./fixtures";
import { inlineForPreview, renderSite, templateMetas, templateOf } from "./render";
import { TEMPLATE_IDS } from "./types";

describe.each(TEMPLATE_IDS)("template %s", (id) => {
  const template = templateOf(id);

  it("has honest metadata", () => {
    expect(template.meta.id).toBe(id);
    expect(template.meta.name.length).toBeGreaterThan(0);
    expect(template.meta.traits.length).toBeGreaterThanOrEqual(3);
  });

  it("renders the full fixture to a complete document", () => {
    const site = template.render(FULL);
    const page = site["index.html"];
    expect(page.startsWith("<!doctype html>")).toBe(true);
    expect(page).toContain('<link rel="stylesheet" href="styles.css">');
    expect(page).toContain("<title>Alex Rivera — Security Engineer</title>");
    for (const text of [
      "Alex Rivera",
      "Staff Security Engineer",
      "Acme Security",
      "Vigil",
      "University of Texas at Austin",
      "OSCP",
      "Kubernetes",
      "Present",
    ]) {
      expect(page).toContain(text);
    }
    expect(site["styles.css"].length).toBeGreaterThan(200);
  });

  it("links safely", () => {
    const page = template.render(FULL)["index.html"];
    expect(page).toContain('href="https://github.com/arivera"');
    expect(page).toContain('href="mailto:alex@example.com"');
    expect(page).toContain('href="tel:4155550142"');
  });

  it("renders the sparse fixture without an empty section", () => {
    const page = template.render(SPARSE)["index.html"];
    expect(page).toContain("Jane Doe");
    expect(page).toContain("Engineer");
    expect(page).not.toMatch(/Projects|Skills|Education|Certifications/);
  });

  it("escapes every field of the hostile fixture", () => {
    const site = template.render(HOSTILE);
    for (const file of [site["index.html"], site["styles.css"]]) {
      for (const marker of FORBIDDEN_IN_OUTPUT) {
        expect(file).not.toContain(marker);
      }
    }
    // The name still appears — escaped, not dropped.
    expect(site["index.html"]).toContain("&lt;script&gt;alert(1)&lt;/script&gt; Name");
    // A javascript: URL becomes plain text, never an href.
    expect(site["index.html"]).not.toMatch(/href="javascript/i);
  });

  it("makes no external requests", () => {
    const site = template.render(FULL);
    for (const file of [site["index.html"], site["styles.css"]]) {
      expect(file).not.toMatch(/https?:\/\/[^"'\s)]+\.(css|js|woff2?|ttf|png|jpg|svg)/i);
      expect(file).not.toMatch(/@import|<script/i);
      expect(file).not.toMatch(/fonts\.googleapis|cdnjs|unpkg|jsdelivr/i);
    }
  });

  it("matches its snapshot", () => {
    expect(template.render(FULL)).toMatchSnapshot();
  });
});

describe("renderSite", () => {
  it("adds a README and falls back to the default template for an unknown id", () => {
    const files = renderSite(FULL, "no-such-template");
    expect(Object.keys(files).sort()).toEqual(["README.md", "index.html", "styles.css"]);
    expect(files["README.md"]).toContain("Alex Rivera");
    expect(files["README.md"]).toContain("Minimal");
  });

  it("lists every template once", () => {
    expect(templateMetas().map((meta) => meta.id)).toEqual([...TEMPLATE_IDS]);
  });

  it("inlines the stylesheet for preview and nothing else changes", () => {
    const site = templateOf("minimal").render(FULL);
    const preview = inlineForPreview(site);
    expect(preview).not.toContain('href="styles.css"');
    expect(preview).toContain("<style>");
    expect(preview).toContain(site["styles.css"].slice(0, 40));
    expect(preview.replace(/<style>[\s\S]*<\/style>/, "")).toBe(
      site["index.html"].replace('<link rel="stylesheet" href="styles.css">', ""),
    );
  });

  it("renders what the review form exports", () => {
    // The seam between stages 3 and 4: normalise() output is the input.
    const resume = normalise({ ...FULL, basics: { ...FULL.basics, summary: "  padded  " } });
    expect(renderSite(resume, "minimal")["index.html"]).toContain(">padded<");
  });
});
