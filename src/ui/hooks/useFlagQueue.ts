/**
 * The flag walk: Cmd/Ctrl+Enter accepts and moves to the next flagged
 * field, Cmd/Ctrl+Shift+Enter moves back.
 *
 * The cursor is wherever focus is, read from document.activeElement at
 * the moment of the action — never tracked as state. A tracked cursor can
 * go stale in every way focus can move without an event the tracker sees
 * (a document without window focus fires no focus events at all), and the
 * walk must continue from where the user actually is: after they clicked
 * into an unflagged field, after undo, after a card was removed under
 * them. Next and prev are computed over the flag queue relative to that
 * position in document order.
 */
import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { EntryId, FieldKey } from "../review/keys";
import { isEntryId, parseFieldKey } from "../review/keys";
import { nextFlagKey } from "../review/selectors";
import type { ReviewState } from "../review/state";

interface Options {
  state: ReviewState;
  rootRef: RefObject<HTMLElement | null>;
  /** Expand the card holding a key, so its control exists to be focused. */
  ensureVisible: (id: EntryId) => void;
  /** Bumps when a new document loads, to re-run the initial autofocus. */
  loadSeq: number;
}

function ownerOf(key: FieldKey): EntryId | null {
  const parsed = parseFieldKey(key);
  return parsed.scope === "entry" && isEntryId(parsed.id) ? parsed.id : null;
}

export function useFlagQueue({ state, rootRef, ensureVisible, loadSeq }: Options) {
  const pending = useRef<FieldKey | null>(null);

  /** The field key under focus right now, or null if focus is elsewhere. */
  const cursor = useCallback((): FieldKey | null => {
    const root = rootRef.current;
    const active = document.activeElement;
    if (!root || !(active instanceof HTMLElement) || !root.contains(active)) return null;
    return (active.closest<HTMLElement>("[data-fkey]")?.dataset.fkey as FieldKey | undefined) ?? null;
  }, [rootRef]);

  const focusKey = useCallback(
    (key: FieldKey) => {
      const root = rootRef.current;
      if (!root) return;
      const escaped = key.replace(/"/g, '\\"');
      const element = root.querySelector<HTMLElement>(`[data-fkey="${escaped}"]`);
      if (!element) {
        // The card is collapsed; expand it and try again after render.
        const owner = ownerOf(key);
        if (owner) {
          ensureVisible(owner);
          pending.current = key;
        }
        return;
      }
      const focusable =
        element.matches("input, textarea, button, select, [tabindex]") && !element.hasAttribute("disabled")
          ? element
          : element.querySelector<HTMLElement>("input:not(:disabled), textarea:not(:disabled), button:not(:disabled)");
      const target = focusable ?? element;
      target.focus();
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) target.select?.();
      target.scrollIntoView({ block: "center" });
    },
    [rootRef, ensureVisible],
  );

  // Retry a focus that had to expand a card first.
  useEffect(() => {
    if (pending.current) {
      const key = pending.current;
      pending.current = null;
      focusKey(key);
    }
  });

  const goTo = useCallback(
    (direction: 1 | -1, from: ReviewState = state) => {
      // Wrap. Imports append entries that sit earlier in document order
      // than wherever the walk has reached, and a walk that stops at the
      // bottom with flags still above it is a walk the user has to restart
      // by hand. The wrap must not land back on the cursor itself, which
      // is what happens when the cursor is the last flag on the page.
      const here = cursor();
      const wrapped = nextFlagKey(from, null, direction);
      const key = nextFlagKey(from, here, direction) ?? (wrapped === here ? null : wrapped);
      if (key) focusKey(key);
      return key;
    },
    [state, cursor, focusKey],
  );

  // On load, land in the first flagged field so the walk starts itself.
  //
  // focusKey is called directly, not parked in `pending`. The retry effect
  // above runs before this one on the mount pass, and nothing else is
  // guaranteed to re-render the form afterwards — in the first version the
  // focus arrived only when autosave's debounced status update happened to
  // re-render, 400 ms late, and never at all with storage unavailable.
  // StrictMode's double effect pass masked it in development.
  const autoFocused = useRef(-1);
  useEffect(() => {
    if (autoFocused.current === loadSeq) return;
    autoFocused.current = loadSeq;
    const first = nextFlagKey(state, null, 1);
    if (first) {
      const owner = ownerOf(first);
      if (owner) ensureVisible(owner);
      focusKey(first);
    }
    // Only on a new document; the walk owns focus after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadSeq]);

  return {
    cursor,
    next: (from?: ReviewState) => goTo(1, from),
    prev: (from?: ReviewState) => goTo(-1, from),
    focusKey,
  };
}
