/**
 * Copy the pdf.js worker into public/ so it is served from a stable, hashed-free path.
 *
 * Why not `import.meta.url`: from pdf.js v4 onward the worker is shipped as an
 * .mjs that neither Vite nor webpack resolve automatically, and Vite's content
 * hashing rewrites `import.meta.url` at build time so the resolved path is
 * correct in dev and wrong in a production bundle. Copying the file to public/
 * and pointing workerSrc at BASE_URL sidesteps both problems, and keeps the app
 * working at a domain root (Vercel) and under a subpath (GitHub Pages).
 *
 * Runs on postinstall so a pdfjs-dist upgrade can never leave a stale worker
 * behind — a version-skewed worker fails in ways that look like parser bugs.
 */
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const destinationDir = join(root, "public");
const destination = join(destinationDir, "pdf.worker.min.mjs");

if (!existsSync(source)) {
  console.error(
    `[copy-pdf-worker] ${source} not found. Is pdfjs-dist installed? Skipping.`,
  );
  process.exit(0);
}

mkdirSync(destinationDir, { recursive: true });
copyFileSync(source, destination);
console.log("[copy-pdf-worker] public/pdf.worker.min.mjs updated");
