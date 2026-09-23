/**
 * Undo and redo, as a wrapper around the review reducer.
 *
 * Every widget dispatches SET_FIELD on every keystroke, so the history has
 * to decide what an undo step is without help from the widgets — a
 * COMMIT-on-blur would have to be honoured by every control and would race
 * the shortcut that moves focus to the next flag. The rule is that
 * consecutive SET_FIELDs on the same key are one step: typing a company
 * name is one undo, and anything else that happens in between (another
 * field, a move, a review chip) seals it.
 *
 * Whole states go on the stacks. Structural sharing keeps that cheap — an
 * edit copies one entry and one array, and source.text is never copied —
 * and it makes undo of a structural change (remove, import, move) the same
 * one-line swap as undo of a keystroke. Not persisted.
 */
import type { FieldKey } from "./keys";
import { checkedReducer, type Action, type ReviewState } from "./state";

export interface HistoryState {
  present: ReviewState;
  /** Oldest first; the last element is what UNDO restores. */
  past: ReviewState[];
  /** Nearest first; the last element is what REDO restores. */
  future: ReviewState[];
  /** The key the last step is still absorbing keystrokes for, or null once sealed. */
  lastEdit: FieldKey | null;
}

export type HistoryAction = Action | { type: "UNDO" } | { type: "REDO" };

/**
 * Enough for the corpus walk — the criterion is ~20 stops, and a run of
 * delete-delete-delete on a mis-split column is a handful — while bounding
 * memory: each entry shares almost everything with its neighbour, but the
 * one entry it does not share is a fresh object per step.
 */
export const HISTORY_CAP = 100;

export function initialHistory(present: ReviewState): HistoryState {
  return { present, past: [], future: [], lastEdit: null };
}

export function reviewHistoryReducer(h: HistoryState, a: HistoryAction): HistoryState {
  switch (a.type) {
    case "UNDO": {
      const previous = h.past[h.past.length - 1];
      if (!previous) return h;
      return {
        present: previous,
        past: h.past.slice(0, -1),
        future: [...h.future, h.present],
        // Sealed: typing in the field just undone must start a new step,
        // or the undo point it needs would be replaced away.
        lastEdit: null,
      };
    }

    case "REDO": {
      const next = h.future[h.future.length - 1];
      if (!next) return h;
      return {
        present: next,
        past: [...h.past, h.present],
        future: h.future.slice(0, -1),
        lastEdit: null,
      };
    }

    case "LOAD_PARSE":
    case "HYDRATE":
    case "RESET":
      // A wholesale load is a new document; undoing across it would resurrect
      // a resume the user just replaced.
      return initialHistory(checkedReducer(h.present, a));

    default: {
      const present = checkedReducer(h.present, a);
      // The reducer returns its input for a no-op (unchanged value, move at
      // an end, unknown id). Nothing happened, so nothing is recorded — and
      // an open step stays open.
      if (present === h.present) return h;

      if (a.type === "SET_FIELD" && a.key === h.lastEdit) {
        return { ...h, present };
      }

      const past = [...h.past, h.present];
      if (past.length > HISTORY_CAP) past.shift();
      return {
        present,
        past,
        future: [],
        lastEdit: a.type === "SET_FIELD" ? a.key : null,
      };
    }
  }
}
