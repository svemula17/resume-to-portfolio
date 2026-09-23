/**
 * Every text fixture is parsed and diffed against its expected JSON.
 *
 * This is the regression net for the whole parser. A change that alters the
 * output for any fixture fails here with a readable diff, so parser work is
 * reviewed as a diff rather than judged by feel. To accept a change, run
 * `npm run fixtures:update` and read what it wrote.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseText } from "./index";

const textDir = join(__dirname, "..", "..", "fixtures", "text");
const expectedDir = join(__dirname, "..", "..", "fixtures", "expected");

const fixtures = readdirSync(textDir).filter((name) => name.endsWith(".txt"));

describe("text fixtures", () => {
  it("has at least one fixture", () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it.each(fixtures)("%s parses to its expected JSON", (name) => {
    const stem = name.replace(/\.txt$/, "");
    const text = readFileSync(join(textDir, name), "utf8");
    const expected = JSON.parse(readFileSync(join(expectedDir, `${stem}.json`), "utf8"));

    expect(parseText(text).data).toEqual(expected);
  });

  it.each(fixtures)("%s never throws and always yields a name", (name) => {
    const result = parseText(readFileSync(join(textDir, name), "utf8"));
    expect(result.data.basics.name.length).toBeGreaterThan(0);
  });
});
