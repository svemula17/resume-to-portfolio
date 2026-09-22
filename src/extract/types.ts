/**
 * The extraction layer's output types.
 *
 * These live in their own module so `layout/` can depend on the shape of a
 * page without importing pdfjs-dist. Extraction must not know about layout;
 * layout must not know about pdf.js.
 */

/** One run of text as the PDF content stream emitted it, in top-left coords. */
export interface TextItem {
  str: string;
  /** Distance from the left edge of the page, in PDF points. */
  x: number;
  /** Distance from the TOP edge of the page, in PDF points. See pdf.ts. */
  y: number;
  width: number;
  height: number;
  fontName: string;
  bold: boolean;
}

export interface Page {
  /** 1-based, as printed. */
  pageNumber: number;
  width: number;
  height: number;
  items: TextItem[];
  /**
   * True when the page yielded no text at all — a scan, or a resume exported
   * as an image. There is no OCR in this app by design, so this must surface
   * to the user as a clear message rather than an empty result.
   */
  imageOnly: boolean;
}
