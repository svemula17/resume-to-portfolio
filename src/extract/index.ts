/** Public surface of the extraction layer. */
export { extractTextItems, ImageOnlyPdfError } from "./pdf";
export { extractDocxText, EmptyDocxError } from "./docx";
export type { Page, TextItem } from "./types";

export { detectFormat } from "./format";
export type { SupportedFormat } from "./format";
