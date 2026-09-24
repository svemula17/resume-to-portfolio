/**
 * Render every layout × person to PDF with headless Chrome.
 *
 *   npx tsx scripts/corpus/build.ts                              # all
 *   npx tsx scripts/corpus/build.ts classic                       # one registered layout
 *   npx tsx scripts/corpus/build.ts --module ./layouts/foo.ts     # a layout not yet in index.ts
 *
 * Chrome, not a PDF library. Real resumes come out of Word, Google Docs,
 * Canva and browser-based builders, and what those all have in common is a
 * layout engine placing text into a content stream in whatever order suits
 * the renderer. Chrome's PDF output has exactly that property — a CSS grid
 * sidebar lands in the stream the way a real builder's would — which is
 * what makes these PDFs a fair test and a hand-assembled PDF not.
 *
 * Output is committed: fixtures/corpus/<layout>--<person>.pdf next to its
 * .truth.json. Regenerating needs Chrome; scoring does not.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { LAYOUTS } from "./layouts/index";
import { PEOPLE } from "./people";
import type { CorpusEntry, Layout } from "./types";

const CHROME =
  process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = join(import.meta.dirname, "..", "..", "fixtures", "corpus");

if (!existsSync(CHROME)) {
  console.error(`Chrome not found at ${CHROME}. Set CHROME=/path/to/chrome.`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
let layouts: Layout[];
const moduleFlag = args.indexOf("--module");
if (moduleFlag >= 0) {
  // A module that exports one or more Layout objects, for building a layout
  // before it is registered — so several can be authored side by side
  // without every author editing index.ts at once.
  const modulePath = args[moduleFlag + 1];
  if (!modulePath) {
    console.error("--module needs a path");
    process.exit(1);
  }
  const loaded = (await import(resolve(process.cwd(), modulePath))) as Record<string, unknown>;
  layouts = Object.values(loaded).filter(isLayout);
  if (layouts.length === 0) {
    console.error(`${modulePath} exports no Layout (need id, family, sectionOrder, render)`);
    process.exit(1);
  }
} else {
  const only = args[0];
  layouts = only ? LAYOUTS.filter((layout) => layout.id === only) : LAYOUTS;
  if (layouts.length === 0) {
    console.error(`No layout named ${only}. Known: ${LAYOUTS.map((l) => l.id).join(", ")}`);
    process.exit(1);
  }
}

function isLayout(value: unknown): value is Layout {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Layout).id === "string" &&
    typeof (value as Layout).render === "function" &&
    Array.isArray((value as Layout).sectionOrder)
  );
}

const scratch = join(tmpdir(), "rtp-corpus");
mkdirSync(scratch, { recursive: true });
let built = 0;

for (const layout of layouts) {
  for (const person of PEOPLE) {
    const id = `${layout.id}--${person.id}`;
    const html = join(scratch, `${id}.html`);
    const pdf = join(OUT, `${id}.pdf`);
    writeFileSync(html, layout.render(person.resume));

    execFileSync(
      CHROME,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--no-pdf-header-footer",
        `--print-to-pdf=${pdf}`,
        `file://${html}`,
      ],
      { stdio: "pipe" },
    );

    const entry: CorpusEntry = {
      id,
      layout: layout.id,
      family: layout.family,
      person: person.id,
      sectionOrder: layout.sectionOrder,
      truth: person.resume,
    };
    writeFileSync(join(OUT, `${id}.truth.json`), `${JSON.stringify(entry, null, 2)}\n`);
    built += 1;
    console.log(`${id}.pdf`);
  }
}

console.log(`\n${built} PDFs → ${OUT}`);
