import { readFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { toReadingOrder } from "./src/layout/index.ts";
import { mergeWrappedLines } from "./src/parse/wrap.ts";
const BOLD = /bold/i;
const doc = await getDocument({ data: new Uint8Array(readFileSync(process.argv[2])) }).promise;
const pages = [];
for (let n = 1; n <= doc.numPages; n++) {
  const p = await doc.getPage(n); const vp = p.getViewport({ scale: 1 }); const c = await p.getTextContent();
  const items = c.items.filter(r => typeof r.str === "string" && r.str.trim() !== "").map(raw => ({ str: raw.str, x: raw.transform[4], y: vp.height - raw.transform[5], width: raw.width, height: raw.height, fontName: raw.fontName, bold: false }));
  pages.push({ pageNumber: n, width: vp.width, height: vp.height, items, imageOnly: false });
}
const lines = toReadingOrder(pages);
console.log("RAW lines 12-20:");
for (const l of lines.slice(12, 20)) console.log(`  x=${l.x.toFixed(1)} y=${l.y.toFixed(1)} items=${l.items.length} first="${l.items[0].str.slice(0,12)}" | ${l.text.slice(0, 60)}`);
const merged = mergeWrappedLines(lines);
console.log(`\nraw=${lines.length} merged=${merged.length}`);
