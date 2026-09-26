/**
 * Render every DOCX layout × person to a .docx, next to the PDF corpus.
 *
 *   npx tsx scripts/corpus/build-docx.ts
 *
 * No Word needed: the writer in docx.ts emits the handful of OOXML parts
 * these layouts use. The output is committed like the PDFs, and scored by
 * the same scorer through the product's own DOCX path.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { docx } from "./docx";
import { DOCX_LAYOUTS } from "./docx-layouts/index";
import { PEOPLE } from "./people";
import type { CorpusEntry } from "./types";

const OUT = join(import.meta.dirname, "..", "..", "fixtures", "corpus");
mkdirSync(OUT, { recursive: true });

let built = 0;
for (const layout of DOCX_LAYOUTS) {
  for (const person of PEOPLE) {
    const id = `${layout.id}--${person.id}`;
    writeFileSync(join(OUT, `${id}.docx`), docx(layout.render(person.resume)));
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
    console.log(`${id}.docx`);
  }
}
console.log(`\n${built} DOCX → ${OUT}`);
