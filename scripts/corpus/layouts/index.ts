/**
 * Every layout in the corpus. Adding one is an import and a list entry.
 *
 * The mix is deliberate: the build plan calls for a corpus that is mostly
 * the ordinary case with enough two-column and heavily designed entries to
 * find the failures, because a corpus of twenty single-column resumes says
 * the parser is excellent and teaches nothing. Four single-column families
 * (one of them the timeline rail that must not be read as two columns),
 * three two-column.
 */
import { atsPlain } from "./ats-plain";
import { classic } from "./classic";
import { headerTwoColumn } from "./header-two-column";
import { modernDense } from "./modern-dense";
import { sidebarLeft } from "./sidebar-left";
import { sidebarRight } from "./sidebar-right";
import { timelineRail } from "./timeline-rail";
import type { Layout } from "../types";

export const LAYOUTS: Layout[] = [
  classic,
  atsPlain,
  modernDense,
  timelineRail,
  headerTwoColumn,
  sidebarLeft,
  sidebarRight,
];
