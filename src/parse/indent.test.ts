import { describe, expect, it } from "vitest";
import type { Line } from "../layout";
import { markIndentedBullets } from "./indent";

function line(text: string, x: number, y: number, width = text.length * 5.5): Line {
  return {
    items: [{ str: text, x, y, width, height: 11, fontName: "f", bold: false }],
    y,
    height: 11,
    isBold: false,
    x,
    right: x + width,
    text,
  };
}

describe("markIndentedBullets", () => {
  it("marks lines indented under a column edge as bullets", () => {
    // Chrome's PDF text layer: no glyphs, only the indent.
    const lines = [
      line("EXPERIENCE", 50, 100),
      line("Senior Engineer Mar 2021 – Present", 50, 116),
      line("Northwind Freight, Chicago, IL", 50, 132),
      line("Cut p99 latency by forty percent.", 66, 148),
      line("Led the migration of sixty services.", 66, 164),
      line("Site Reliability Engineer Aug 2018 – Feb 2021", 50, 184),
    ];

    expect(markIndentedBullets(lines).map((l) => l.text)).toEqual([
      "EXPERIENCE",
      "Senior Engineer Mar 2021 – Present",
      "Northwind Freight, Chicago, IL",
      "• Cut p99 latency by forty percent.",
      "• Led the migration of sixty services.",
      "Site Reliability Engineer Aug 2018 – Feb 2021",
    ]);
  });

  it("does not mark the wrapped tail of a bullet as a second bullet", () => {
    const lines = [
      line("EXPERIENCE", 50, 100),
      line("Engineer", 50, 116),
      line("Acme", 50, 132),
      line("Built the detection pipeline that catches credential stuffing in under a minute and", 66, 148, 440),
      line("then some more words", 66, 164, 110),
      line("Second bullet here.", 66, 180, 100),
    ];

    const marked = markIndentedBullets(lines).map((l) => l.text);
    expect(marked[3]!.startsWith("• ")).toBe(true);
    expect(marked[4]).toBe("then some more words");
    expect(marked[5]).toBe("• Second bullet here.");
  });

  it("leaves a sidebar column alone: its lines sit far left of the main edge", () => {
    const lines = [
      line("SKILLS", 40, 100),
      line("Go", 40, 116),
      line("Rust", 40, 132),
      line("EXPERIENCE", 220, 100),
      line("Engineer", 220, 116),
      line("Acme", 220, 132),
      line("Did the thing.", 236, 148),
    ];

    const marked = markIndentedBullets(lines).map((l) => l.text);
    expect(marked.filter((t) => t.startsWith("• "))).toEqual(["• Did the thing."]);
  });

  it("is a no-op on the text path, where there is no geometry", () => {
    const lines = [line("a", 0, 14), line("b", 0, 28)];
    expect(markIndentedBullets(lines)).toBe(lines);
  });
});
