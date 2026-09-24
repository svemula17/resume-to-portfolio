/**
 * Which extractor a file needs. Split from index.ts so the landing page can
 * decide without pulling pdf.js and mammoth into its chunk.
 */
export type SupportedFormat = "pdf" | "docx";

/** Decide how to read a file, by extension first and MIME type as a fallback. */
export function detectFormat(file: File): SupportedFormat | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";

  // Browsers are inconsistent about the MIME type they attach to a drag-and-
  // dropped file, so extension wins and this is only a backstop.
  if (file.type === "application/pdf") return "pdf";
  if (
    file.type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }

  return null;
}
