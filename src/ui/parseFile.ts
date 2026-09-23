/**
 * File in, parse result and source out. The product copy of the spike's
 * upload path, without the rendering the debug overlay needed.
 */
import { detectFormat, extractDocxText, extractTextItems } from "../extract";
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

  if (format === "docx") {
    const text = await extractDocxText(file);
    return {
      result: parseText(text),
      source: { fileName: file.name, format: "docx", text },
    };
  }

  if (format !== "pdf") {
    throw new Error(`Unsupported file type: ${file.name}. Upload a PDF or DOCX.`);
  }

  const pages = await extractTextItems(file);
  const lines = toPageReadingOrders(pages).flatMap((order) => order.lines);
  return {
    result: parseLines(lines),
    source: {
      fileName: file.name,
      format: "pdf",
      text: lines.map((line) => line.text).join("\n"),
    },
  };
}

/** Pasted text: the path that makes the exit criterion measurable. */
export function parsePastedText(text: string, fileName = "pasted-resume.txt"): Parsed {
  return {
    result: parseText(text),
    source: { fileName, format: "text", text },
  };
}
