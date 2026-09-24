/**
 * Authored CSS only. No user text is ever interpolated into a stylesheet,
 * so this file is a plain string and the escaping layer does not apply.
 */
export const css = `/* Creative — Resume → Portfolio */

:root {
  --bg: #fffdfa;
  --text: #1c1917;
  --muted: #6b6259;
  --rule: #e9e1d7;
  --accent: #a83a19;
  --band: #f6ebdf;
  --card: #faf4ec;
  --measure: 46rem;
  --serif: Georgia, "Times New Roman", Times, serif;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #151311;
    --text: #ebe5dc;
    --muted: #a69c90;
    --rule: #2e2825;
    --accent: #f29b74;
    --band: #201a16;
    --card: #1d1815;
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
  font-family: var(--sans);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  overflow-wrap: anywhere;
}

.wrap {
  max-width: var(--measure);
  margin: 0 auto;
  padding: 0 1.25rem;
}

h1, h2, h3 {
  font-family: var(--serif);
  font-weight: 400;
  line-height: 1.15;
  margin: 0;
}

a {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.18em;
}

a:hover {
  text-decoration-thickness: 2px;
}

/* Masthead: the tinted band. */

.masthead {
  background: var(--band);
  border-bottom: 1px solid var(--rule);
  padding: 5rem 0 3.5rem;
}

.masthead .role {
  margin: 0 0 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
}

.masthead h1 {
  font-size: clamp(2.6rem, 1.8rem + 5vw, 5.5rem);
  letter-spacing: -0.02em;
  line-height: 1.02;
  max-width: 14ch;
}

.lede {
  font-family: var(--serif);
  font-size: clamp(1.2rem, 1rem + 0.9vw, 1.55rem);
  line-height: 1.4;
  margin: 1.75rem 0 0;
  max-width: 34rem;
}

.contact, .profiles {
  list-style: none;
  padding: 0;
  margin: 2rem 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.5rem;
  font-size: 0.95rem;
}

.contact + .profiles {
  margin-top: 0.6rem;
}

.contact a, .profiles a {
  color: inherit;
}

.profiles a {
  color: var(--accent);
  font-weight: 500;
}

/* Sections and their numbered headings. */

main {
  counter-reset: section;
  padding-top: 1rem;
  padding-bottom: 6rem;
}

main > section {
  margin-top: 4.5rem;
}

h2 {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  font-size: 2rem;
  letter-spacing: -0.01em;
  margin: 0 0 1.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid var(--text);
}

h2::before {
  counter-increment: section;
  /* Decorative; the empty alt text keeps "zero one" out of the heading's name. */
  content: counter(section, decimal-leading-zero) / "";
  font-size: 1.5rem;
  font-style: italic;
  color: var(--accent);
}

h3 {
  font-size: 1.3rem;
}

.when, .where, .tech {
  margin: 0;
  color: var(--muted);
  font-size: 0.95rem;
}

.sep {
  margin: 0 0.15em;
  white-space: nowrap;
}

.muted {
  color: var(--muted);
}

/* Experience: a timeline. Dates sit in a column left of the rule on wide
   screens and stack above the role on narrow ones. */

.timeline {
  list-style: none;
  margin: 0;
  padding: 0;
}

.timeline > li {
  position: relative;
  border-left: 2px solid var(--rule);
  padding: 0 0 2.5rem 1.75rem;
}

.timeline > li:last-child {
  padding-bottom: 0;
}

.timeline > li::before {
  /* Drawn with a border, not a background, so it survives printing:
     browsers drop backgrounds and shadows under print-color-adjust: economy
     but keep borders. */
  content: "";
  position: absolute;
  left: -7px;
  top: 0.4rem;
  width: 0;
  height: 0;
  border: 6px solid var(--accent);
  border-radius: 50%;
  outline: 3px solid var(--bg);
}

.timeline .when {
  font-family: var(--serif);
  font-style: italic;
  color: var(--accent);
  margin-bottom: 0.25rem;
}

.entry .where {
  margin-top: 0.2rem;
}

.entry ul {
  list-style: disc;
  margin: 0.75rem 0 0;
  padding-left: 1.2rem;
}

.entry li {
  margin: 0.35rem 0;
}

.entry p {
  margin: 0.5rem 0 0;
}

/* Education and certifications: plain entries. */

.entry.plain {
  padding: 1.25rem 0;
  border-top: 1px solid var(--rule);
}

.entry.plain:first-of-type {
  border-top: 0;
  padding-top: 0;
}

.entry-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.25rem 1rem;
}

/* Projects: a card grid. */

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
  gap: 1.25rem;
}

.card {
  background: var(--card);
  border: 1px solid var(--rule);
  border-top: 3px solid var(--accent);
  border-radius: 4px;
  padding: 1.5rem 1.5rem 1.4rem;
  display: flex;
  flex-direction: column;
}

.card h3 {
  font-size: 1.35rem;
}

.card p {
  margin: 0.6rem 0 0;
  flex: 1;
}

.tags, .pills {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.tags {
  margin-top: 1.25rem;
}

.tags li, .pills li {
  font-size: 0.82rem;
  line-height: 1.3;
  padding: 0.28rem 0.7rem;
  border-radius: 999px;
}

.tags li {
  color: var(--accent);
  border: 1px solid currentColor;
}

/* Skills: pill groups. */

.skills {
  margin: 0;
  display: grid;
  gap: 1.5rem;
}

.skills dt {
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 0.6rem;
}

.skills dd {
  margin: 0;
}

.pills li {
  background: var(--band);
  border: 1px solid var(--rule);
  font-size: 0.92rem;
  padding: 0.35rem 0.85rem;
}

/* Certifications. */

.certs {
  list-style: none;
  margin: 0;
  padding: 0;
}

.certs li {
  padding: 0.85rem 0;
  border-top: 1px solid var(--rule);
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.75rem;
  align-items: baseline;
}

.certs li:first-child {
  border-top: 0;
  padding-top: 0;
}

.cert-name {
  font-family: var(--serif);
  font-size: 1.15rem;
}

.certs time {
  margin-left: auto;
  font-size: 0.95rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* Wide screens: dates move into a column to the left of the timeline. */

@media (min-width: 720px) {
  /* The date column exists only when there are dates; a resume with none
     would otherwise float its entries 10rem in from an empty gutter. */
  .timeline.dated {
    margin-left: 10rem;
  }
  .timeline .when {
    position: absolute;
    top: 0.2rem;
    right: calc(100% + 1.75rem);
    width: 8.5rem;
    margin: 0;
    font-size: 0.9rem;
    text-align: right;
    line-height: 1.4;
  }
}

@media (max-width: 480px) {
  html { font-size: 16px; }
  .masthead { padding: 3.5rem 0 2.5rem; }
  main > section { margin-top: 3.5rem; }
  h2 { font-size: 1.7rem; }
  .card { padding: 1.25rem; }
  .timeline > li { padding-left: 1.4rem; }
  .certs time { margin-left: 0; }
}

@media print {
  :root { --bg: #fff; --text: #000; --muted: #555; --rule: #999; --accent: #000; --band: #fff; --card: #fff; }
  html { font-size: 11pt; }
  body { background: #fff; color: #000; }
  .wrap { max-width: none; padding: 0; }
  .masthead { background: none; border-bottom: 1px solid #000; padding: 0 0 1.5rem; }
  .masthead h1 { font-size: 2.4rem; }
  .masthead .role, h2::before, .timeline .when, .profiles a, .tags li { color: #000; }
  .lede { font-size: 1.1rem; }
  main { padding: 0; }
  main > section { margin-top: 1.75rem; break-inside: avoid-page; }
  h2 { margin-bottom: 1rem; break-after: avoid; }
  .timeline { margin-left: 0; }
  .timeline .when { position: static; width: auto; text-align: left; }
  .timeline > li { border-left-color: #000; padding-bottom: 1.25rem; }
  .timeline > li::before { border-color: #000; outline-color: #fff; }
  .cards { display: block; }
  .card { background: none; border: 0; border-top: 1px solid #000; border-radius: 0; padding: 1rem 0; }
  .card:first-child { border-top: 0; padding-top: 0; }
  .pills li { background: none; border-color: #000; }
  .entry, .card, .certs li { break-inside: avoid; }
  a { color: #000; text-decoration: none; }
  a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 0.85em; color: #555; }
}
`;
