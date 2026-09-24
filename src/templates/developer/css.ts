/**
 * Authored CSS only. No user text is ever interpolated into a stylesheet,
 * so this file is a plain string and the escaping layer does not apply.
 *
 * Dark is the native mode here; the light palette is derived from it, not
 * the other way round. One accent, used for the top rule, links and the
 * section markers, and nowhere else.
 */
export const css = `/* Developer — Resume → Portfolio */

:root {
  --bg: #f7f8f8;
  --surface: #ffffff;
  --text: #1b2027;
  --muted: #5f6b76;
  --rule: #dde2e7;
  --chip-bg: #eef1f4;
  --chip-text: #2f3944;
  --accent: #0b7a6c;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --mono: ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --rail: 16rem;
  --measure: 66rem;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0d1117;
    --surface: #0d1117;
    --text: #d8dee6;
    --muted: #8a94a0;
    --rule: #222a34;
    --chip-bg: #171d25;
    --chip-text: #b9c2cc;
    --accent: #4fd1b8;
  }
}

* {
  box-sizing: border-box;
}

html {
  font-size: 16px;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--sans);
  line-height: 1.6;
  border-top: 3px solid var(--accent);
  overflow-wrap: break-word;
  -webkit-font-smoothing: antialiased;
}

.site {
  max-width: var(--measure);
  margin: 0 auto;
  padding: 3.5rem 1.5rem 6rem;
  display: grid;
  grid-template-columns: var(--rail) minmax(0, 1fr);
  gap: 0 4rem;
  align-items: start;
}

.rail {
  /* Sticks where it already sits, so nothing jumps on the first scroll:
     the site's padding-top plus the body's top rule. Capped to the
     viewport so a tall rail scrolls instead of pinning its tail off-screen. */
  position: sticky;
  top: calc(3.5rem + 3px);
  max-height: calc(100vh - 3.5rem - 3px);
  overflow-y: auto;
  scrollbar-width: thin;
}

.content {
  min-width: 0;
}

h1, h2, h3 {
  margin: 0;
  line-height: 1.25;
}

h1 {
  font-size: 1.85rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

h2 {
  font-family: var(--mono);
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--muted);
  margin: 0 0 1.25rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--rule);
}

h2::before {
  /* Decorative; the empty alt text keeps it out of the accessible name. */
  content: "// " / "";
  color: var(--accent);
}

h3 {
  font-size: 1.05rem;
  font-weight: 600;
}

a {
  color: var(--accent);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 120ms ease;
}

a:hover, a:focus-visible {
  border-bottom-color: currentColor;
}

a:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Rail */

.masthead .role {
  margin: 0.3rem 0 0;
  font-size: 1rem;
  color: var(--muted);
}

.contact, .links {
  list-style: none;
  padding: 0;
  margin: 1.5rem 0 0;
  font-size: 0.85rem;
  line-height: 1.5;
}

.contact li, .links li {
  margin: 0.4rem 0;
  overflow-wrap: anywhere;
}

.contact {
  color: var(--muted);
}

.contact a {
  color: inherit;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.15em;
}

.contact a:hover {
  color: var(--text);
}

.links {
  font-family: var(--mono);
  font-size: 0.8rem;
}

.rail > section {
  margin-top: 2.5rem;
}

.skills {
  margin: 0;
}

.skills dt {
  font-family: var(--mono);
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin: 1rem 0 0.4rem;
}

.skills dt:first-child {
  margin-top: 0;
}

.skills dd {
  margin: 0;
}

/* A group with no category has no visible label; give it room instead. */
.skills dt.sr-only + dd {
  margin-top: 0.85rem;
}

/* Chips */

.tags {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.tags li {
  font-family: var(--mono);
  font-size: 0.72rem;
  line-height: 1.4;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  background: var(--chip-bg);
  color: var(--chip-text);
  border: 1px solid var(--rule);
  overflow-wrap: anywhere;
}

/* Column */

.content > section {
  margin-bottom: 3rem;
}

.content > section:last-child {
  margin-bottom: 0;
}

.summary {
  margin: 0;
  font-size: 1.1rem;
  line-height: 1.6;
  max-width: 38rem;
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
  gap: 0.15rem 1.5rem;
}

.when {
  margin: 0;
  font-family: var(--mono);
  font-size: 0.78rem;
  color: var(--muted);
  white-space: nowrap;
}

.where {
  margin: 0.15rem 0 0;
  font-size: 0.95rem;
  color: var(--muted);
}

.entry ul {
  margin: 0.6rem 0 0;
  padding-left: 1.1rem;
}

.entry li {
  margin: 0.3rem 0;
  padding-left: 0.15rem;
}

.entry li::marker {
  color: var(--muted);
}

.entry p {
  margin: 0.45rem 0 0;
  max-width: 40rem;
}

.entry .tags {
  margin-top: 0.65rem;
}

.certs {
  list-style: none;
  padding: 0;
  margin: 0;
}

.certs li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.15rem 1.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--rule);
}

.certs .cert-text {
  flex: 1 1 14rem;
}

.certs li:last-child {
  border-bottom: 0;
}

.certs .when {
  white-space: normal;
  text-align: right;
}

.cert-name {
  font-weight: 600;
}

.muted {
  color: var(--muted);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (max-width: 760px) {
  /* One column: masthead, then the content, then skills — the order of a
     printed resume. Without this the skill chips sit between the contact
     line and the summary and push "who I am" below the fold. */
  .site {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 2.5rem 1rem 4rem;
  }
  .rail {
    display: contents;
  }
  .masthead {
    order: 0;
    padding-bottom: 2rem;
    margin-bottom: 2rem;
    border-bottom: 1px solid var(--rule);
  }
  .content {
    order: 1;
  }
  .rail > section {
    order: 2;
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 1px solid var(--rule);
  }
  h1 {
    font-size: 1.7rem;
  }
  .contact, .links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1.25rem;
    margin-top: 1.25rem;
  }
  .contact li, .links li {
    margin: 0;
  }
  .when {
    white-space: normal;
  }
}

@media (max-width: 380px) {
  html { font-size: 15px; }
  .site { padding-left: 0.85rem; padding-right: 0.85rem; }
}

@media print {
  :root { --bg: #fff; --text: #000; --muted: #555; --rule: #999; --accent: #000; --chip-bg: #fff; --chip-text: #000; }
  html { font-size: 10.5pt; }
  body { background: #fff; color: #000; border-top: 0; }
  .site { max-width: none; padding: 0; display: block; }
  .rail { position: static; max-height: none; overflow: visible; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #999; }
  .rail > section { margin-top: 1rem; }
  .contact, .links { display: flex; flex-wrap: wrap; gap: 0.2rem 1rem; margin-top: 0.6rem; }
  .contact li, .links li { margin: 0; }
  a { color: #000; border: 0; }
  a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 0.85em; color: #555; }
  h2 { color: #333; border-bottom-color: #999; margin-top: 1.25rem; break-after: avoid; }
  h2::before { color: #000; }
  .tags li { background: none; border-color: #999; color: #000; }
  .content > section { margin-bottom: 1.5rem; }
  .entry { break-inside: avoid; }
  .certs li { border-bottom-color: #ccc; }
}
`;
