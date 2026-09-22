/**
 * DOCX extraction via mammoth.
 *
 * extractRawText, not convertToHtml, on purpose: the whole point is that DOCX
 * feeds the *same* rule engine as PDF. Converting to HTML would produce a
 * second, differently-shaped input and a second parser to maintain — and it
 * would mean accepting untrusted markup from a user's file, which mammoth does
 * not sanitise.
 *
 * Note what is lost: a DOCX arrives with no geometry at all. There is no x/y,
 * so there is nothing for column detection to do. Section detection on a DOCX
 * has to fall back to keyword matching, since the "bold and alone on its line"
 * heuristic needs positions the raw-text path does not carry.
 */
// Imported as "mammoth" rather than "mammoth/mammoth.browser": the package's
// `browser` field already swaps its two Node-only modules for browser builds,
// and the bare specifier is the one that carries type declarations.
import { extractRawText } from "mammoth";

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
  const result = await extractRawText({ arrayBuffer });
  const text = result.value.trim();

  if (text === "") {
    throw new EmptyDocxError(
      "This DOCX contains no readable text. If the content is inside images or " +
        "text boxes, export it as a text-based PDF instead.",
    );
  }

  return text;
}
