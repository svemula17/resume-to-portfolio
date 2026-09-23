import { readFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { toReadingOrder } from "./src/layout/index.ts";
import { parseLines, parseText } from "./src/parse/index.ts";

const path = process.argv[2];
const BOLD = /bold|semibold|demibold|demi|black|heavy|[-_,]bd\b/i;

async function pagesOf(path) {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(path)) }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const p = await doc.getPage(n);
    const vp = p.getViewport({ scale: 1 });
    const c = await p.getTextContent();
    const items = [];
    for (const raw of c.items) {
      if (typeof raw.str !== "string" || raw.str.trim() === "") continue;
      items.push({ str: raw.str, x: raw.transform[4], y: vp.height - raw.transform[5],
        width: raw.width, height: raw.height, fontName: raw.fontName,
        bold: BOLD.test(raw.fontName) || BOLD.test(c.styles[raw.fontName]?.fontFamily ?? "") });
    }
    pages.push({ pageNumber: n, width: vp.width, height: vp.height, items, imageOnly: items.length === 0 });
  }
  return pages;
}

const result = path.endsWith(".txt")
  ? parseText(readFileSync(path, "utf8"))
  : parseLines(toReadingOrder(await pagesOf(path)));

console.log(JSON.stringify(result.data, null, 2));
console.log("\n=== CONFIDENCE ===");
const low = Object.entries(result.confidence).filter(([, v]) => v < 0.6);
console.log(`${Object.keys(result.confidence).length} fields scored, ${low.length} flagged for review:`);
for (const [k, v] of low) console.log(`  ${k}: ${v.toFixed(2)}`);
