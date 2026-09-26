/**
 * A minimal DOCX writer, enough to imitate what Word produces.
 *
 * No library: a DOCX is a ZIP of XML parts, and the handful this corpus
 * needs — paragraphs, runs, bold, tabs with a right stop, bullet
 * numbering, a table — is under a hundred lines. fflate is already a
 * dependency. Everything is escaped on the way in; the people are
 * invented, but the writer would be wrong to assume it.
 */
import { strToU8, zipSync } from "fflate";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  size?: number;
}

export interface ParagraphOptions {
  bullet?: boolean;
  /** A right-aligned tab stop at the page's text width, for dates. */
  tabRight?: boolean;
  align?: "center" | "right";
  /** Space after, in twentieths of a point. */
  after?: number;
}

/** A paragraph. A "\t" run is a tab. */
export function paragraph(runs: Array<Run | string>, options: ParagraphOptions = {}): string {
  const ppr: string[] = [];
  if (options.bullet) ppr.push('<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>');
  if (options.tabRight) ppr.push('<w:tabs><w:tab w:val="right" w:pos="9360"/></w:tabs>');
  if (options.align) ppr.push(`<w:jc w:val="${options.align}"/>`);
  if (options.after !== undefined) ppr.push(`<w:spacing w:after="${options.after}"/>`);
  const body = runs
    .map((run) => {
      const r = typeof run === "string" ? { text: run } : run;
      if (r.text === "\t") return "<w:r><w:tab/></w:r>";
      const rpr = [r.bold ? "<w:b/>" : "", r.italic ? "<w:i/>" : "", r.size ? `<w:sz w:val="${r.size * 2}"/>` : ""].join("");
      return `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ""}<w:t xml:space="preserve">${esc(r.text)}</w:t></w:r>`;
    })
    .join("");
  return `<w:p>${ppr.length > 0 ? `<w:pPr>${ppr.join("")}</w:pPr>` : ""}${body}</w:p>`;
}

/** A table: rows of cells, each cell a list of paragraphs (already rendered). */
export function table(rows: string[][][], widths: number[]): string {
  const grid = widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("");
  const body = rows
    .map(
      (cells) =>
        `<w:tr>${cells
          .map((paras, i) => `<w:tc><w:tcPr><w:tcW w:w="${widths[i] ?? 4680}" w:type="dxa"/></w:tcPr>${paras.join("") || "<w:p/>"}</w:tc>`)
          .join("")}</w:tr>`,
    )
    .join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${body}</w:tbl>`;
}

/** The bytes of a .docx holding the given body XML. */
export function docx(bodyXml: string): Uint8Array {
  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`,
    "word/numbering.xml": `<?xml version="1.0" encoding="UTF-8"?><w:numbering xmlns:w="${W}"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`,
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${W}"><w:body>${bodyXml}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr></w:body></w:document>`,
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, xml]) => [name, strToU8(xml)])));
}
