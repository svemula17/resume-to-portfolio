/**
 * pdf.js worker wiring. Import this once, before any getDocument() call.
 *
 * workerSrc is built from BASE_URL rather than import.meta.url. Vite rewrites
 * import.meta.url during content hashing, so a worker resolved that way works
 * in dev and 404s in a production build. BASE_URL is substituted at build time
 * from the `base` config, which makes this path correct both at a domain root
 * (Vercel serves "/") and under a repository subpath (GitHub Pages serves
 * "/<repo>/").
 *
 * The file itself is copied into public/ by scripts/copy-pdf-worker.mjs on
 * postinstall — see that script for why it is not imported directly.
 */
import { GlobalWorkerOptions } from "pdfjs-dist";

let configured = false;

export function configurePdfWorker(): void {
  if (configured) return;
  GlobalWorkerOptions.workerSrc = `${import.meta.env.BASE_URL}pdf.worker.min.mjs`;
  configured = true;
}

configurePdfWorker();
