/**
 * Fixture tooling for the parser.
 *
 *   node scripts/fixtures.mjs update   rewrite expected/*.json from current output
 *   node scripts/fixtures.mjs score    print a per-fixture scoreboard
 *
 * Runs the real parser through tsx so there is one implementation, not a
 * test copy of it.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { parseText } from "../src/parse/index.ts";

const textDir = new URL("../fixtures/text/", import.meta.url).pathname;
const expectedDir = new URL("../fixtures/expected/", import.meta.url).pathname;
const mode = process.argv[2] ?? "score";

/** Flatten to dotted paths so a scoreboard can count fields, not objects. */
function flatten(value, prefix = "", out = {}) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${prefix}${index}.`, out));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) flatten(child, `${prefix}${key}.`, out);
  } else if (value !== undefined) {
    out[prefix.replace(/\.$/, "")] = value;
  }
  return out;
}

const fixtures = readdirSync(textDir).filter((name) => name.endsWith(".txt"));
let totalRight = 0;
let totalFields = 0;

for (const name of fixtures) {
  const stem = basename(name, ".txt");
  const actual = parseText(readFileSync(join(textDir, name), "utf8")).data;
  const expectedPath = join(expectedDir, `${stem}.json`);

  if (mode === "update") {
    writeFileSync(expectedPath, `${JSON.stringify(actual, null, 2)}\n`);
    console.log(`wrote ${expectedPath}`);
    continue;
  }

  if (!existsSync(expectedPath)) {
    console.log(`${stem}: no expected JSON — run \`update\` and review it`);
    continue;
  }

  const expected = flatten(JSON.parse(readFileSync(expectedPath, "utf8")));
  const got = flatten(actual);
  const keys = Object.keys(expected);
  const right = keys.filter((key) => got[key] === expected[key]).length;
  totalRight += right;
  totalFields += keys.length;

  const pct = keys.length === 0 ? 100 : Math.round((right / keys.length) * 100);
  console.log(`${stem.padEnd(40)} ${String(right).padStart(3)}/${String(keys.length).padEnd(3)} ${pct}%`);
  for (const key of keys) {
    if (got[key] !== expected[key]) {
      console.log(`    ✗ ${key}\n        expected: ${JSON.stringify(expected[key])}\n        got:      ${JSON.stringify(got[key])}`);
    }
  }
}

if (mode !== "update" && totalFields > 0) {
  console.log(`\n${"TOTAL".padEnd(40)} ${totalRight}/${totalFields} ${Math.round((totalRight / totalFields) * 100)}%`);
}
