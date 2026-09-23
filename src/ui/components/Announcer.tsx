/**
 * One aria-live region for the whole form.
 *
 * Moves, removes and imports change the page structurally without changing
 * the focused element, which is exactly the case screen readers miss. One
 * polite region, written to by whichever component just did something, is
 * enough — and one is deliberately the number, because several regions
 * announcing at once read as noise.
 */
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { AnnouncerContext, type Announce } from "./announcer-context";

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");

  // One region that lives for the life of the form. Screen readers watch a
  // live region for changes; a region that is unmounted and re-inserted
  // already containing its text is a new element, not a change, and many
  // readers say nothing. The first version keyed the div on a nonce and
  // was silent for exactly that reason.
  //
  // Repeating the same text must still announce, and equal text is not a
  // change either — so the region is cleared first and filled on the next
  // task. A timeout rather than requestAnimationFrame: rAF is paused in a
  // hidden document, and an announcement queued there should still land
  // when the tab comes back.
  const announce = useCallback<Announce>((next) => {
    setMessage("");
    setTimeout(() => setMessage(next), 0);
  }, []);

  const value = useMemo(() => announce, [announce]);

  return (
    <AnnouncerContext.Provider value={value}>
      {children}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {message}
      </div>
    </AnnouncerContext.Provider>
  );
}
