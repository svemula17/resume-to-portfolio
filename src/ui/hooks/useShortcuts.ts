/**
 * One keydown listener on the form root.
 *
 * The app owns undo only when focus is outside a text control. Inside one,
 * native undo owns the text being typed — fighting it breaks IME
 * composition and autocorrect, and a bulk paste into a bullets textarea
 * followed by Cmd+Z should do what every other textarea does.
 *
 * Cmd/Ctrl+Enter was chosen over Cmd+J (Chrome's downloads shelf) and
 * Ctrl+. (IME). Alt+Arrow and Delete on a card header are handled by the
 * card itself; this hook owns the document-level chords.
 */
import { useEffect, type RefObject } from "react";

interface Handlers {
  acceptAndNext: () => void;
  back: () => void;
  undo: () => void;
  redo: () => void;
  /** Cmd/Ctrl+S: flush the autosave rather than open the browser's dialog. */
  save: () => void;
}

function inTextControl(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) return target.type !== "checkbox";
  return target.isContentEditable;
}

export function useShortcuts(rootRef: RefObject<HTMLElement | null>, handlers: Handlers): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;

      if (event.key === "Enter") {
        event.preventDefault();
        if (event.shiftKey) handlers.back();
        else handlers.acceptAndNext();
        return;
      }

      if (event.key.toLowerCase() === "s" && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        handlers.save();
        return;
      }

      if (inTextControl(event.target)) return;

      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) handlers.redo();
        else handlers.undo();
      } else if (event.key.toLowerCase() === "y" && event.ctrlKey) {
        event.preventDefault();
        handlers.redo();
      }
    };

    root.addEventListener("keydown", onKey);
    return () => root.removeEventListener("keydown", onKey);
  }, [rootRef, handlers]);
}
