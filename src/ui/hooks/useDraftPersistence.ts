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
import { DRAFT_KEY, saveDraft, serializeDraft } from "../storage/draft";
import type { StorageLike } from "../storage/safeStorage";

export type AutosaveStatus =
  | { kind: "saved"; at: string }
  | { kind: "saving" }
  | { kind: "reduced"; at: string }
  | { kind: "off"; reason: "unavailable" | "quota" }
  | { kind: "foreign" };

const DEBOUNCE_MS = 400;

/**
 * The envelope minus its timestamp. Two states that differ only in when
 * they were saved are the same draft, and comparing full envelopes would
 * never skip a write.
 */
function fingerprint(state: ReviewState): string {
  return serializeDraft(state, "");
}

/** Strip savedAt from a raw envelope so a boot-time draft can seed the fingerprint. */
function fingerprintOfRaw(raw: string | null): string | null {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as { savedAt?: unknown };
    return JSON.stringify({ ...parsed, savedAt: "" });
  } catch {
    return null;
  }
}

export function useDraftPersistence(
  present: ReviewState,
  storage: StorageLike | null,
  /** The raw draft read at boot, so hydrating does not immediately re-save it. */
  bootRaw: string | null = null,
): { status: AutosaveStatus; flush: () => void; resume: () => void } {
  const [status, setStatus] = useState<AutosaveStatus>(() => {
    if (!storage) return { kind: "off", reason: "unavailable" };
    if (bootRaw !== null) {
      try {
        const at = (JSON.parse(bootRaw) as { savedAt?: string }).savedAt;
        if (typeof at === "string") return { kind: "saved", at };
      } catch {
        // Unparseable draft: boot() already reported it; fall through.
      }
    }
    return { kind: "saving" };
  });
  const lastWritten = useRef<string | null>(bootRaw);
  const lastFingerprint = useRef<string | null>(fingerprintOfRaw(bootRaw));
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

    // Skip an unchanged draft before touching storage. A boot-time hydrate
    // re-saving itself is the case that matters: the write fires a storage
    // event in every other tab, and each of them reads it as a foreign edit.
    const next = fingerprint(state);
    if (next === lastFingerprint.current) return;

    const result = saveDraft(storage, state, new Date().toISOString());
    if (result.ok) {
      lastWritten.current = result.written;
      lastFingerprint.current = result.reduced ? null : next;
      const at = new Date().toISOString();
      setStatus(result.reduced ? { kind: "reduced", at } : { kind: "saved", at });
    } else {
      setStatus({ kind: "off", reason: result.reason });
    }
  }, [storage]);

  // Leave the foreign pause: this tab is about to own the draft again,
  // because the user loaded a new file or started over here.
  const resume = useCallback(() => {
    foreign.current = false;
    lastWritten.current = null;
    lastFingerprint.current = null;
    setStatus(storage ? { kind: "saving" } : { kind: "off", reason: "unavailable" });
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

  return { status, flush, resume };
}
