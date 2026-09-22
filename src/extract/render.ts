/**
 * Render PDF pages to images, for the debug overlay only.
 *
 * Kept apart from pdf.ts because it is a different job with a different
 * lifetime: extraction is what the app does, rendering is what the spike's
 * debug view needs to draw boxes on top of. The parser must never depend on
 * this module.
 */
import { getDocument } from "pdfjs-dist";
import "./worker-setup";

export interface RenderedPage {
  pageNumber: number;
  /** Rendered size in CSS pixels — `scale` times the page's point size. */
  width: number;
  height: number;
  /** Size in PDF points, which is the coordinate space every box uses. */
  pointWidth: number;
  pointHeight: number;
  dataUrl: string;
}

/**
 * @param scale 1 renders at PDF point size, which is legible enough to see a
 * gutter but not to read body text. 1.5 is the useful default for the overlay.
 */
export async function renderPageImages(file: File, scale = 1.5): Promise<RenderedPage[]> {
  const buffer = await file.arrayBuffer();
  const loadingTask = getDocument({ data: new Uint8Array(buffer) });
  const document = await loadingTask.promise;

  try {
    const rendered: RenderedPage[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const pdfPage = await document.getPage(pageNumber);
      const viewport = pdfPage.getViewport({ scale });
      const pointViewport = pdfPage.getViewport({ scale: 1 });

      const canvas = window.document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not acquire a 2D canvas context.");

      await pdfPage.render({ canvas, canvasContext: context, viewport }).promise;

      rendered.push({
        pageNumber,
        width: canvas.width,
        height: canvas.height,
        pointWidth: pointViewport.width,
        pointHeight: pointViewport.height,
        dataUrl: canvas.toDataURL("image/png"),
      });
    }

    return rendered;
  } finally {
    await loadingTask.destroy();
  }
}
