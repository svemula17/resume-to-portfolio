/**
 * DOCX extraction via mammoth.
 *
 * convertToHtml, then a reader of mammoth's HTML back into lines — not
 * extractRawText, which was the first choice and the wrong one. Raw text
 * drops list markers (a Word bullet is numbering, not a character), so
 * every bullet arrived as a heading line, and it puts a blank line after
 * every paragraph, which the entry splitter read as a boundary each time.
 * The HTML keeps bullets, tabs and tables; docx-html.ts turns those into
 * the same text shape the PDF path produces, so one parser serves both.
 *
 * The HTML never reaches the DOM. It is parsed as a string for its text,
 * which is what makes accepting mammoth's unsanitised markup safe here.
 *
 * What is still lost: geometry. There is no x/y, so column detection has
 * nothing to do — but a two-column DOCX is a table, and the table reader
 * knows which way to read one.
 */
// Imported as "mammoth" rather than "mammoth/mammoth.browser": the package's
// `browser` field already swaps its two Node-only modules for browser builds,
// and the bare specifier is the one that carries type declarations.
import { convertToHtml } from "mammoth";
import { htmlToText } from "./docx-html";

/** Thrown when a DOCX yields nothing readable. */
export class EmptyDocxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmptyDocxError";
  }
}

/**
 * Extract plain text from a .docx file.
 *
 * @throws EmptyDocxError when the document has no text content.
 */
export async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await convertToHtml({ arrayBuffer });
  const text = htmlToText(result.value).trim();

  if (text === "") {
    throw new EmptyDocxError(
      "This DOCX contains no readable text. If the content is inside images or " +
        "text boxes, export it as a text-based PDF instead.",
    );
  }

  return text;
}
