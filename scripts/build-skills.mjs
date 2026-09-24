/**
 * Build src/data/skills.json: the vocabulary the review form uses to tell a
 * skill from a sentence fragment.
 *
 * Three sources, chosen for their licences as much as their coverage (see
 * README "Licence notes"): O*NET "Technology Skills" (CC BY 4.0) for the long
 * tail of named software, GitHub Linguist (MIT) for every language name and
 * alias, devicon (MIT) for the frameworks and tools developers actually list.
 * "Tools Used" from O*NET is deliberately not fetched — it is hammers and
 * forklifts, and a resume that says "forklift" under skills is not the
 * audience.
 *
 * The output is data, not code, so it is committed. Fetching at build time
 * would make `npm run build` depend on three third-party hosts and would let
 * the vocabulary drift silently between deploys; running this script by hand
 * and reviewing the diff is the point. The script is idempotent apart from
 * the `generated` stamp.
 *
 * Normalisation lives here AND in src/data/vocabulary.ts (`normaliseTerm`).
 * The runtime cannot import this file and this file has no build step, so
 * the rules are duplicated on purpose. Keep them in sync; the test suite
 * checks the committed data against the runtime version.
 *
 * Node 22, ESM, no dependencies. Linguist's YAML is read with a line scanner
 * rather than a YAML parser: we need top-level keys and one list field, and a
 * dependency for that is a dependency to audit and update forever.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const destinationDir = join(root, "src", "data");
const destination = join(destinationDir, "skills.json");

/** Hard ceiling from the plan: the JSON is code-split, but it still ships. */
const SIZE_LIMIT = 220 * 1024;

const ONET_ATTRIBUTION =
  "This product includes information from the O*NET 29.1 Database by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the CC BY 4.0 license. O*NET® is a trademark of USDOL/ETA.";

const SOURCES = [
  {
    name: "O*NET 29.1 Technology Skills",
    url: "https://www.onetcenter.org/dl_files/database/db_29_1_text/Technology%20Skills.txt",
    license: "CC BY 4.0",
    attribution: ONET_ATTRIBUTION,
  },
  {
    name: "GitHub Linguist languages.yml",
    url: "https://raw.githubusercontent.com/github-linguist/linguist/master/lib/linguist/languages.yml",
    license: "MIT",
    attribution: "Copyright (c) 2017 GitHub, Inc. Licensed under the MIT License.",
  },
  {
    name: "devicon",
    url: "https://raw.githubusercontent.com/devicons/devicon/master/devicon.json",
    license: "MIT",
    attribution: "Copyright (c) 2015 konpa. Licensed under the MIT License.",
  },
];

// ---------------------------------------------------------------------------
// Normalisation — mirrored in src/data/vocabulary.ts. Change both or neither.
// ---------------------------------------------------------------------------

/**
 * O*NET names products the way a catalogue does: "Ansible software",
 * "Microsoft Project (software)", "Bitcoin mining program". Nobody writes
 * the suffix on a resume, so it goes.
 */
const ONET_SUFFIX = /\s+(?:\(software\)|software|program)$/;

/**
 * Trailing punctuation is list debris ("Python," or "Go."), but "+" and "#"
 * are spelling: "c++" and "c#" must survive, and a closing bracket is more
 * often balanced ("(software)", "[deprecated]") than stray. So the class is
 * explicit.
 */
const TRAILING_PUNCTUATION = /[.,;:!?'"`]+$/;

/**
 * The only single letters that are languages people list. Linguist has all
 * five; every other lone character in the sources is an initial or a typo.
 */
const SINGLE_LETTER_LANGUAGES = new Set(["c", "d", "j", "q", "r"]);

const MAX_LENGTH = 60;

/** @param {string} term @returns {string} */
function normaliseTerm(term) {
  let value = term.trim().replace(/\s+/g, " ").toLowerCase();
  // Punctuation first, so "Sitecore software." still loses its suffix, and
  // then until nothing changes, so the result is a fixed point: normalising
  // a normalised term is a no-op, which is what lets the test suite check
  // the committed data against the runtime copy of these rules.
  let previous;
  do {
    previous = value;
    value = value.replace(TRAILING_PUNCTUATION, "").replace(ONET_SUFFIX, "").trim();
  } while (value !== previous);
  return value;
}

/** @param {string} term @returns {boolean} */
function isKeepable(term) {
  if (term === "") return false;
  if (term.length > MAX_LENGTH) return false;
  if (term.length === 1) return SINGLE_LETTER_LANGUAGES.has(term);
  return true;
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

/** @param {string} url @returns {Promise<string>} */
async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`[build-skills] ${url}: HTTP ${response.status}`);
  }
  return response.text();
}

/**
 * Tab-separated, header row. Column 2 is the software name, column 5 is the
 * "Hot Technology" flag. Rows repeat per occupation, so the same example
 * appears dozens of times; the dedupe below is what turns 32k rows into 9k
 * terms.
 *
 * @param {string} text
 * @returns {{ terms: Set<string>, hot: Set<string> }}
 */
function parseOnet(text) {
  const terms = new Set();
  const hot = new Set();
  const lines = text.split(/\r?\n/);
  const header = (lines[0] ?? "").split("\t");
  const exampleColumn = header.indexOf("Example");
  const hotColumn = header.indexOf("Hot Technology");
  if (exampleColumn < 0 || hotColumn < 0) {
    throw new Error(`[build-skills] O*NET header changed: ${header.join(" | ")}`);
  }
  for (const line of lines.slice(1)) {
    if (line === "") continue;
    const columns = line.split("\t");
    const term = normaliseTerm(columns[exampleColumn] ?? "");
    if (!isKeepable(term)) continue;
    terms.add(term);
    if ((columns[hotColumn] ?? "").trim() === "Y") hot.add(term);
  }
  return { terms, hot };
}

/** YAML scalars in this file are bare or double-quoted; nothing fancier. */
function unquote(value) {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * languages.yml is a map of language name -> properties. A language name is
 * any unindented line ending in a colon; its aliases are the "- item" lines
 * that follow an indented "aliases:" until the next indented key. Every
 * other list in the file (extensions, filenames, interpreters) is skipped by
 * the same rule, which is why this needs no YAML parser.
 *
 * @param {string} text
 * @returns {Set<string>}
 */
function parseLinguist(text) {
  const terms = new Set();
  let inAliases = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, "");
    if (line === "" || line.startsWith("#")) continue;

    if (!/^\s/.test(line)) {
      inAliases = false;
      if (!line.endsWith(":")) continue;
      const term = normaliseTerm(unquote(line.slice(0, -1)));
      if (isKeepable(term)) terms.add(term);
      continue;
    }

    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item) {
      if (inAliases) {
        const term = normaliseTerm(unquote(item[1] ?? ""));
        if (isKeepable(term)) terms.add(term);
      }
      continue;
    }

    inAliases = /^\s+aliases:\s*$/.test(line);
  }
  return terms;
}

/**
 * A JSON array of icons; "name" is the canonical slug and "altnames" the
 * spellings people actually use ("nodejs" -> "node.js"). Both are kept
 * because a resume may use either.
 *
 * @param {string} text
 * @returns {Set<string>}
 */
function parseDevicon(text) {
  const terms = new Set();
  const icons = JSON.parse(text);
  if (!Array.isArray(icons)) throw new Error("[build-skills] devicon.json is not an array");
  for (const icon of icons) {
    const names = [icon.name, ...(Array.isArray(icon.altnames) ? icon.altnames : [])];
    for (const name of names) {
      if (typeof name !== "string") continue;
      const term = normaliseTerm(name);
      if (isKeepable(term)) terms.add(term);
    }
  }
  return terms;
}

// ---------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------

/** @param {object} data @returns {string} */
function serialise(data) {
  // Compact JSON: the arrays are thousands of entries and pretty-printing
  // them costs ~40% of the size budget for no reviewability gain — the diff
  // of a sorted, one-line array is already legible in any tool that splits
  // on commas, and nobody reads 9k lines of strings.
  return `${JSON.stringify(data)}\n`;
}

const [onetText, linguistText, deviconText] = await Promise.all(
  SOURCES.map((source) => fetchText(source.url)),
);

const onet = parseOnet(onetText);
const linguist = parseLinguist(linguistText);
const devicon = parseDevicon(deviconText);

let onetTerms = onet.terms;
let trimmedLongTerms = false;

/** @param {Set<string>} onetSet */
function assemble(onetSet) {
  const all = new Set([...onetSet, ...linguist, ...devicon]);
  const skills = [...all].sort();
  const hot = [...onet.hot].filter((term) => all.has(term)).sort();
  const data = {
    version: 1,
    generated: new Date().toISOString(),
    sources: SOURCES,
    hot,
    skills,
  };
  return { data, json: serialise(data) };
}

let built = assemble(onetTerms);

// Five-plus-word O*NET entries are catalogue descriptions ("Oracle PeopleSoft
// Enterprise Human Capital Management"), not what anyone types under Skills.
// They are only dropped when the budget forces it, so the summary says so.
// Hot technologies are exempt: O*NET flagging them is exactly the signal the
// review form wants, and there are a dozen of them.
if (Buffer.byteLength(built.json) > SIZE_LIMIT) {
  onetTerms = new Set(
    [...onet.terms].filter((term) => onet.hot.has(term) || term.split(" ").length < 5),
  );
  trimmedLongTerms = true;
  built = assemble(onetTerms);
}

const bytes = Buffer.byteLength(built.json);
if (bytes > SIZE_LIMIT) {
  console.error(`[build-skills] ${bytes} bytes exceeds the ${SIZE_LIMIT} byte budget even after trimming`);
  process.exit(1);
}

mkdirSync(destinationDir, { recursive: true });
writeFileSync(destination, built.json);

console.log("[build-skills] src/data/skills.json updated");
console.log(`  O*NET      ${onetTerms.size} terms (${onet.hot.size} hot)${trimmedLongTerms ? ` — dropped ${onet.terms.size - onetTerms.size} entries of 5+ words to fit the size budget` : ""}`);
console.log(`  Linguist   ${linguist.size} terms`);
console.log(`  devicon    ${devicon.size} terms`);
console.log(`  total      ${built.data.skills.length} unique, ${built.data.hot.length} hot`);
console.log(`  bytes      ${bytes} (${(bytes / 1024).toFixed(1)} KB, budget ${SIZE_LIMIT / 1024} KB)`);
