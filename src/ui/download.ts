/**
 * Hand the user a file. The one DOM-touching export helper, and deliberately
 * the only one: everything upstream of it is a pure function of state.
 *
 * Blob + a temporary anchor rather than the File System Access API, because
 * the anchor works in every browser and needs no permission prompt. The URL
 * is revoked on the next tick so the click has time to dereference it.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadText(text: string, fileName: string, mime = "application/json"): void {
  downloadBlob(new Blob([text], { type: mime }), fileName);
}
