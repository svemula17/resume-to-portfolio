/**
 * Authored CSS only. No user text is ever interpolated into a stylesheet,
 * so this file is a plain string and the escaping layer does not apply.
 */
export const css = `/* Minimal — Resume → Portfolio */

:root {
  --bg: #ffffff;
  --text: #1a1a1a;
  --muted: #6b6b6b;
  --rule: #e6e6e6;
  --accent: #1a1a1a;
  --measure: 40rem;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #111213;
    --text: #e8e8e6;
    --muted: #9a9a96;
    --rule: #2a2b2d;
    --accent: #e8e8e6;
  }
}

* {
  box-sizing: border-box;
}

html {
  font-size: 17px;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}

.page {
  max-width: var(--measure);
  margin: 0 auto;
  padding: 4rem 1.25rem 6rem;
}

h1, h2, h3 {
  font-family: Georgia, "Times New Roman", Times, serif;
  font-weight: 400;
  line-height: 1.2;
  margin: 0;
}

h1 {
  font-size: 2.4rem;
  letter-spacing: -0.01em;
}

h2 {
  font-size: 0.85rem;
  font-family: inherit;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--muted);
  margin: 3rem 0 1rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid var(--rule);
}

h3 {
  font-size: 1.15rem;
}

a {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.15em;
}

a:hover {
  text-decoration-thickness: 2px;
}

.masthead .role {
  margin: 0.35rem 0 0;
  font-size: 1.15rem;
  color: var(--muted);
}

.contact {
  list-style: none;
  padding: 0;
  margin: 1.25rem 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1.25rem;
  font-size: 0.95rem;
}

.summary {
  font-size: 1.1rem;
  margin: 2.5rem 0 0;
}

.entry {
  margin: 0 0 1.75rem;
}

.entry:last-child {
  margin-bottom: 0;
}

.entry-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.25rem 1rem;
}

.when, .tech, .where {
  margin: 0;
  color: var(--muted);
  font-size: 0.95rem;
}

.where {
  margin-top: 0.15rem;
}

.entry ul {
  margin: 0.6rem 0 0;
  padding-left: 1.2rem;
}

.entry li {
  margin: 0.25rem 0;
}

.entry p {
  margin: 0.5rem 0 0;
}

.skills {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.5rem 1.5rem;
  margin: 0;
}

.skills dt {
  color: var(--muted);
  font-size: 0.95rem;
}

.skills dd {
  margin: 0;
}

.certs {
  margin: 0;
  padding-left: 1.2rem;
}

.certs li {
  margin: 0.35rem 0;
}

.muted {
  color: var(--muted);
}

/* An uncategorised group has a hidden dt; its dd takes the whole row. */
.skills dt.sr-only + dd {
  grid-column: 1 / -1;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (max-width: 480px) {
  html { font-size: 16px; }
  .page { padding-top: 2.5rem; }
  h1 { font-size: 2rem; }
  .entry-head { flex-direction: column; align-items: flex-start; gap: 0.1rem; }
  .skills { grid-template-columns: 1fr; gap: 0.15rem 0; }
  .skills dd { margin-bottom: 0.6rem; }
}

@media print {
  /* Tokens, not just body colour: every muted rule must resolve to ink. */
  :root { --bg: #fff; --text: #000; --muted: #555; --rule: #999; --accent: #000; }
  html { font-size: 11pt; }
  body { background: #fff; color: #000; }
  .page { max-width: none; padding: 0; }
  a { color: #000; text-decoration: none; }
  a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 0.85em; color: #555; }
  h2 { margin-top: 1.5rem; break-after: avoid; }
  .entry { break-inside: avoid; }
}
`;
