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
  const [nonce, setNonce] = useState(0);

  const announce = useCallback<Announce>((next) => {
    setMessage(next);
    // Repeating the same message must still announce, and a live region only
    // fires on DOM change; the nonce forces a change even for equal text.
    setNonce((n) => n + 1);
  }, []);

  const value = useMemo(() => announce, [announce]);

  return (
    <AnnouncerContext.Provider value={value}>
      {children}
      <div className="sr-only" aria-live="polite" aria-atomic="true" key={nonce}>
        {message}
      </div>
    </AnnouncerContext.Provider>
  );
}
