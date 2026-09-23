/**
 * localStorage that never throws.
 *
 * Every way the browser can refuse is a throw, and they happen at different
 * moments: Safari with "Block all cookies" throws SecurityError on the
 * `window.localStorage` property access itself, not on a call; a full disk
 * or a private window with a zero quota throws on setItem only; a sandboxed
 * iframe throws on everything. The app has one answer to all of them — a
 * status line, never a modal — so this module turns each into a value.
 *
 * Everything takes a StorageLike so tests inject a stub without a DOM.
 */

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export type SetResult = { ok: true } | { ok: false; reason: "quota" | "unavailable" };

/**
 * A write that is rolled back immediately. Reading `window.localStorage`
 * proves nothing on Safari lockdown or with a zero quota — only a setItem
 * does — and finding out at boot is what lets the header say "autosave off"
 * before the first keystroke instead of after the first lost edit.
 */
const PROBE_KEY = "rtp.probe";

export function getLocalStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    const storage: StorageLike | null | undefined = window.localStorage;
    if (!storage) return null;
    storage.setItem(PROBE_KEY, "1");
    storage.removeItem(PROBE_KEY);
    return storage;
  } catch {
    return null;
  }
}

/**
 * The four spellings of "full" across engines: the modern name, the legacy
 * WebKit/Blink code, the legacy Gecko code, and the Gecko name. Anything
 * else is treated as the storage being gone, which is not worth a retry.
 */
function isQuotaError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { name, code } = error as { name?: unknown; code?: unknown };
  return (
    name === "QuotaExceededError" ||
    code === 22 ||
    code === 1014 ||
    name === "NS_ERROR_DOM_QUOTA_REACHED"
  );
}

export function safeGet(s: StorageLike, k: string): string | null {
  try {
    return s.getItem(k);
  } catch {
    return null;
  }
}

export function safeSet(s: StorageLike, k: string, v: string): SetResult {
  try {
    s.setItem(k, v);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: isQuotaError(error) ? "quota" : "unavailable" };
  }
}

export function safeRemove(s: StorageLike, k: string): void {
  try {
    s.removeItem(k);
  } catch {
    // Nothing to do: a key that cannot be removed cannot be read either.
  }
}
