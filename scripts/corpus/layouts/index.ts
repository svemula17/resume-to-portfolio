/**
 * Every layout in the corpus. Adding one is an import and a list entry.
 *
 * The mix is deliberate: the build plan calls for a corpus that is mostly
 * the ordinary case with enough two-column and heavily designed entries to
 * find the failures, because a corpus of twenty single-column resumes says
 * the parser is excellent and teaches nothing.
 */
import { classic } from "./classic";
import type { Layout } from "../types";

export const LAYOUTS: Layout[] = [classic];
