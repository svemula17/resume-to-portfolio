import { describe, expect, it } from "vitest";
import { htmlToLines } from "./docx-html";

describe("htmlToLines", () => {
  it("keeps bullets, drops bold, decodes entities, and turns tabs into cell gaps", () => {
    const html =
      "<p><strong>Senior SRE</strong>\tMar 2021 &#8211; Present</p><p>Northwind &amp; Co</p><ul><li>Cut p99 latency.</li><li>Led the <em>migration</em></li></ul>";
    expect(htmlToLines(html)).toEqual([
      "Senior SRE   Mar 2021 – Present",
      "Northwind & Co",
      "• Cut p99 latency.",
      "• Led the migration",
    ]);
  });

  it("reads a tall two-cell table column by column: the layout case", () => {
    const html =
      "<table><tr><td><p>SKILLS</p><p>Kubernetes</p><p>Terraform</p><p>AWS</p></td><td><p>EXPERIENCE</p><p>Senior SRE</p><p>Northwind</p><ul><li>Cut latency.</li></ul></td></tr></table>";
    expect(htmlToLines(html)).toEqual([
      "SKILLS",
      "Kubernetes",
      "Terraform",
      "AWS",
      "EXPERIENCE",
      "Senior SRE",
      "Northwind",
      "• Cut latency.",
    ]);
  });

  it("reads a table of one-line cells row by row with cell gaps: the grid case", () => {
    const html =
      "<table><tr><td><p>Mar 2021 – Present</p></td><td><p>Senior SRE, Northwind</p></td></tr><tr><td><p>Aug 2018 – Feb 2021</p></td><td><p>SRE, Halcyon Pay</p></td></tr></table>";
    expect(htmlToLines(html)).toEqual([
      "Mar 2021 – Present   Senior SRE, Northwind",
      "Aug 2018 – Feb 2021   SRE, Halcyon Pay",
    ]);
  });

  it("splits a paragraph on <br>, and an encoded angle bracket is text, not a tag", () => {
    const html = "<p>Line one<br />Line &lt;two&gt;</p><h1>Name</h1><p><span class=\"x\">Span</span></p>";
    const lines = htmlToLines(html);
    expect(lines).toEqual(["Line one", "Line <two>", "Name", "Span"]);
    for (const tag of ["<p>", "<h1>", "<span", "<br"]) expect(lines.join("\n")).not.toContain(tag);
  });
});
