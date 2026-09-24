/**
 * Files → a ZIP blob, in the browser, synchronously.
 *
 * fflate over JSZip: ~10 KB against ~95 KB, and the site is three small
 * text files, so the synchronous path is instant and the worker-based
 * async API would be ceremony. `zipSync` with level 6 is the default the
 * README, HTML and CSS compress well under; nothing here is large enough
 * for the level to matter.
 */
import { strToU8, zipSync } from "fflate";

export type SiteFileMap = Record<string, string>;

/** The bytes of a ZIP holding the given text files at the archive root. */
export function zipBytes(files: SiteFileMap): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [name, text] of Object.entries(files)) {
    entries[name] = strToU8(text);
  }
  return zipSync(entries, { level: 6 });
}

export function zipBlob(files: SiteFileMap): Blob {
  const bytes = zipBytes(files);
  // A fresh ArrayBuffer-backed copy: Blob accepts BufferSource, and a
  // Uint8Array over a shared or resizable buffer is not one under lib.dom.
  return new Blob([Uint8Array.from(bytes)], { type: "application/zip" });
}

/**
 * "alex-rivera-portfolio.zip" from a name. Anything that is not a letter
 * or digit becomes a hyphen, runs collapse, and an empty result falls
 * back to "portfolio" — a download called "-portfolio.zip" is a bug.
 */
export function zipFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug ? `${slug}-` : ""}portfolio.zip`;
}
