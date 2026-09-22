/**
 * pdf.js wrapper: a File in, positioned text items out.
 *
 * This module does exactly one thing — turn a PDF into `Page[]` in top-left
 * screen coordinates. It makes no judgements about lines, columns or sections.
 */
import { getDocument } from "pdfjs-dist";
import type { TextItem as PdfTextItem, TextStyle } from "pdfjs-dist/types/src/display/api";
import "./worker-setup";
import type { Page, TextItem } from "./types";

/** Thrown when a PDF has no extractable text on any page. */
export class ImageOnlyPdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageOnlyPdfError";
  }
}

/**
 * Font names that pdf.js reports are internal ids like "g_d0_f1", so weight
 * has to be read from the resolved family — typically an embedded subset name
 * such as "BCDEEE+Calibri-Bold". Checking both covers documents where pdf.js
 * passes the original name straight through.
 *
 * "Semibold"/"Demi"/"Black"/"Heavy" count as bold: on a resume they are used
 * for exactly the same purpose as bold — emphasising a name or a section
 * header — and the downstream heuristics only care about that intent.
 */
const BOLD_PATTERN = /bold|semibold|demibold|demi|black|heavy|[-_,]bd\b/i;

function isBold(fontName: string, style: TextStyle | undefined): boolean {
  if (BOLD_PATTERN.test(fontName)) return true;
  return style ? BOLD_PATTERN.test(style.fontFamily) : false;
}

/** TextContent.items holds marked-content markers too; those have no `str`. */
function isTextItem(item: PdfTextItem | { type?: string }): item is PdfTextItem {
  return typeof (item as PdfTextItem).str === "string";
}

/**
 * Extract positioned text from every page of a PDF.
 *
 * @throws ImageOnlyPdfError when no page yields any text — a scan, or a resume
 * exported as an image. There is no OCR here by design, so this has to fail
 * loudly rather than hand the parser an empty document and let it produce junk.
 */
export async function extractTextItems(file: File): Promise<Page[]> {
  const buffer = await file.arrayBuffer();
  // pdf.js takes ownership of the buffer it is given, so hand it a copy —
  // otherwise re-parsing the same File (which the debug UI does on every
  // toggle) throws on a detached ArrayBuffer.
  const loadingTask = getDocument({ data: new Uint8Array(buffer) });
  const document = await loadingTask.promise;

  try {
    const pages: Page[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const pdfPage = await document.getPage(pageNumber);
      const viewport = pdfPage.getViewport({ scale: 1 });
      const content = await pdfPage.getTextContent();

      const items: TextItem[] = [];
      for (const raw of content.items) {
        if (!isTextItem(raw)) continue;
        // Whitespace-only runs carry no signal but do distort the average
        // character width that line merging depends on.
        if (raw.str.trim() === "") continue;

        const transform = raw.transform;
        const x = Number(transform[4] ?? 0);
        const yFromBottom = Number(transform[5] ?? 0);

        items.push({
          str: raw.str,
          x,
          // pdf.js uses a BOTTOM-LEFT origin. Normalise once, here, so every
          // module downstream can assume screen coordinates and "sort by y"
          // means "top to bottom" without anyone having to remember this.
          // The value is the text baseline, not the top of the glyph box;
          // baselines are what line grouping should cluster on, because two
          // runs at different font sizes on the same line share a baseline
          // but not a box top.
          y: viewport.height - yFromBottom,
          width: raw.width,
          height: raw.height,
          fontName: raw.fontName,
          bold: isBold(raw.fontName, content.styles[raw.fontName]),
        });
      }

      pages.push({
        pageNumber,
        width: viewport.width,
        height: viewport.height,
        items,
        imageOnly: items.length === 0,
      });
    }

    if (pages.every((page) => page.imageOnly)) {
      throw new ImageOnlyPdfError(
        "This PDF contains no selectable text — it looks like a scan or an image export. " +
          "This app reads text directly and has no OCR, so it cannot parse it. " +
          "Export the resume as a text-based PDF, or upload a DOCX instead.",
      );
    }

    return pages;
  } finally {
    // destroy() lives on the loading task, not the document proxy; it is what
    // tears down the worker. Skipping it leaks a worker per upload.
    await loadingTask.destroy();
  }
}
