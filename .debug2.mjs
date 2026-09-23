import { readFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { toReadingOrder } from "./src/layout/index.ts";
import { mergeWrappedLines } from "./src/parse/wrap.ts";
import { splitIntoSections } from "./src/parse/sections.ts";
import { parseCertificationLine } from "./src/parse/fields/projects.ts";
const doc = await getDocument({ data: new Uint8Array(readFileSync(process.argv[2])) }).promise;
const pages = [];
for (let n = 1; n <= doc.numPages; n++) {
  const p = await doc.getPage(n); const vp = p.getViewport({ scale: 1 }); const c = await p.getTextContent();
  const items = c.items.filter(r => typeof r.str === "string" && r.str.trim() !== "").map(raw => ({ str: raw.str, x: raw.transform[4], y: vp.height - raw.transform[5], width: raw.width, height: raw.height, fontName: raw.fontName, bold: false }));
  pages.push({ pageNumber: n, width: vp.width, height: vp.height, items, imageOnly: false });
}
const sections = splitIntoSections(mergeWrappedLines(toReadingOrder(pages)));
for (const s of sections) console.log(`[${s.kind}] "${s.heading}" ${s.lines.length} lines`);
const certs = sections.find(s => s.kind === "certifications");
for (const l of certs.lines) { console.log("LINE:", JSON.stringify(l.text)); console.log("  ->", JSON.stringify(parseCertificationLine(l.text, 0).map(p => p.value))); }
const skills = sections.find(s => s.kind === "skills");
console.log("\nSKILL LINES:"); for (const l of skills.lines) console.log("  ", JSON.stringify(l.text.slice(0, 100)));
