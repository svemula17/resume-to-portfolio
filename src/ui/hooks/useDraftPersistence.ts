/**
 * Autosave the review state to localStorage.
 *
 * 400 ms trailing debounce on state identity, a synchronous flush on
 * pagehide and on the tab going hidden (not beforeunload, which mobile
 * browsers skip), and a skip when the serialised string equals the last
 * one written — so a boot-time hydrate does not re-save, and our own
 * writes never trip the foreign-write detector.
 *
 * Keeps trying after a failure: a quota that clears resumes silently.
 *
 * The storage event on our key from another tab pauses saves and shows a
 * banner rather than silently entering last-writer-wins; edits after the
 * banner appears are lost on reload, by design.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReviewState } from "../review/state";
import { DRAFT_KEY, saveDraft } from "../storage/draft";
import type { StorageLike } from "../storage/safeStorage";

export type AutosaveStatus =
  | { kind: "saved"; at: string }
  | { kind: "saving" }
  | { kind: "reduced"; at: string }
  | { kind: "off"; reason: "unavailable" | "quota" }
  | { kind: "foreign" };

const DEBOUNCE_MS = 400;

export function useDraftPersistence(
  present: ReviewState,
  storage: StorageLike | null,
): { status: AutosaveStatus; flush: () => void } {
  const [status, setStatus] = useState<AutosaveStatus>(
    storage ? { kind: "saving" } : { kind: "off", reason: "unavailable" },
  );
  const lastWritten = useRef<string | null>(null);
  const timer = useRef<number | null>(null);
  const foreign = useRef(false);
  const latest = useRef(present);
  // Written in an effect, not during render, so flush() from an event
  // handler always sees the last committed state.
  useEffect(() => {
    latest.current = present;
  }, [present]);

  const write = useCallback(() => {
    if (!storage || foreign.current) return;
    const state = latest.current;
    // Nothing to persist before a file is loaded; an empty draft would only
    // ever restore to the upload screen anyway.
    if (state.source === null) return;

    const result = saveDraft(storage, state, new Date().toISOString());
    if (result.ok) {
      if (result.written === lastWritten.current) return;
      lastWritten.current = result.written;
      const at = new Date().toISOString();
      setStatus(result.reduced ? { kind: "reduced", at } : { kind: "saved", at });
    } else {
      setStatus({ kind: "off", reason: result.reason });
    }
  }, [storage]);

  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    write();
  }, [write]);

  useEffect(() => {
    if (!storage) return;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      write();
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [present, storage, write]);

  useEffect(() => {
    if (!storage) return;
    const onHide = () => flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== DRAFT_KEY) return;
      if (event.newValue === lastWritten.current) return;
      foreign.current = true;
      setStatus({ kind: "foreign" });
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
    };
  }, [storage, flush]);

  return { status, flush };
}
