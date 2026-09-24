/**
 * File in, parse result and source out. The product copy of the spike's
 * upload path, without the rendering the debug overlay needed.
 *
 * The extractors are imported on demand. pdf.js is a megabyte and mammoth
 * is not small, and a visitor reading the landing page has not chosen a
 * file yet; splitting them off the entry chunk is the difference between
 * a page that appears instantly and one that does not. Vite turns each
 * dynamic import into its own chunk with no configuration.
 */
import { loadVocabulary } from "../data/vocabulary";
import { detectFormat } from "../extract/format";
import { toPageReadingOrders } from "../layout";
import { parseLines, parseText } from "../parse";
import type { ParseResult } from "../schema/resume";
import type { Source } from "./review/state";

export interface Parsed {
  result: ParseResult;
  source: Source;
}

export async function parseFile(file: File): Promise<Parsed> {
  const format = detectFormat(file);
  // Fetched alongside the extractor, not after it; both are network round
  // trips on first use and there is no reason to serialise them.
  const vocabularyPromise = loadVocabulary();

  if (format === "docx") {
    const { extractDocxText } = await import("../extract/docx");
    const [text, vocabulary] = await Promise.all([extractDocxText(file), vocabularyPromise]);
    return {
      result: parseText(text, { vocabulary }),
      source: { fileName: file.name, format: "docx", text },
    };
  }

  if (format !== "pdf") {
    throw new Error(`Unsupported file type: ${file.name}. Upload a PDF or DOCX.`);
  }

  const { extractTextItems } = await import("../extract/pdf");
  const [pages, vocabulary] = await Promise.all([extractTextItems(file), vocabularyPromise]);
  const lines = toPageReadingOrders(pages).flatMap((order) => order.lines);
  return {
    result: parseLines(lines, { vocabulary }),
    source: {
      fileName: file.name,
      format: "pdf",
      text: lines.map((line) => line.text).join("\n"),
    },
  };
}

/** Pasted text: the path that makes the exit criterion measurable. */
export async function parsePastedText(text: string, fileName = "pasted-resume.txt"): Promise<Parsed> {
  const vocabulary = await loadVocabulary();
  return {
    result: parseText(text, { vocabulary }),
    source: { fileName, format: "text", text },
  };
}

/**
 * Start fetching the extractor chunks before they are needed — on hover or
 * focus of the file input — so the click that follows does not wait on the
 * network. Errors are ignored: the real import on click will surface them.
 */
export function warmExtractors(): void {
  void import("../extract/pdf").catch(() => undefined);
  void import("../extract/docx").catch(() => undefined);
  void loadVocabulary().catch(() => undefined);
}
