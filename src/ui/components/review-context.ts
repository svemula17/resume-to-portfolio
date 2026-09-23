/**
 * What every component of the form needs and would otherwise be handed
 * down through five layers of props: the state, the dispatcher, and the
 * per-load UI state (touched fields, collapsed cards) that ReviewForm owns.
 */
import { createContext, useContext, type Dispatch } from "react";
import type { HistoryAction } from "../review/history";
import type { EntryId, FieldKey } from "../review/keys";
import type { ReviewState } from "../review/state";

export interface ReviewContextValue {
  state: ReviewState;
  dispatch: Dispatch<HistoryAction>;
  /** Zod issues by field key, from export.issues(). */
  issuesByKey: ReadonlyMap<FieldKey, string>;
  /** Fields the user has blurred; issues show only for these until a download is tried. */
  touched: ReadonlySet<FieldKey>;
  markTouched: (key: FieldKey) => void;
  /** After a download attempt with issues, every issue is visible. */
  showAllIssues: boolean;
  isCollapsed: (id: EntryId) => boolean;
  setCollapsed: (id: EntryId, collapsed: boolean) => void;
}

export const ReviewContext = createContext<ReviewContextValue | null>(null);

export function useReview(): ReviewContextValue {
  const value = useContext(ReviewContext);
  if (!value) throw new Error("useReview must be used inside ReviewForm");
  return value;
}
