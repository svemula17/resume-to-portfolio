import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { zipBytes, zipFileName } from "./zip";

describe("zipBytes", () => {
  it("round-trips every file at the archive root", () => {
    const files = {
      "index.html": "<!doctype html><title>x</title>",
      "styles.css": "body{margin:0}",
      "README.md": "# hi\n",
    };
    const unzipped = unzipSync(zipBytes(files));
    expect(Object.keys(unzipped).sort()).toEqual(["README.md", "index.html", "styles.css"]);
    for (const [name, text] of Object.entries(files)) {
      expect(strFromU8(unzipped[name]!)).toBe(text);
    }
  });

  it("preserves non-ASCII text", () => {
    const files = { "index.html": "Résumé — naïve ✓ 日本語" };
    expect(strFromU8(unzipSync(zipBytes(files))["index.html"]!)).toBe(files["index.html"]);
  });

  it("starts with the ZIP local-file-header signature", () => {
    const bytes = zipBytes({ "a.txt": "a" });
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });
});

describe("zipFileName", () => {
  it.each([
    ["Alex Rivera", "alex-rivera-portfolio.zip"],
    ["SAI KUMAR VEMULA", "sai-kumar-vemula-portfolio.zip"],
    ["José Ñandú", "jose-nandu-portfolio.zip"],
    ["  --  ", "portfolio.zip"],
    ["", "portfolio.zip"],
    ["O'Brien, Jr.", "o-brien-jr-portfolio.zip"],
  ])("%j → %s", (name, expected) => {
    expect(zipFileName(name)).toBe(expected);
  });
});
