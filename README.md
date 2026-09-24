# Resume → Portfolio

Upload a resume, get back the source code for a static portfolio site.

Everything happens in the browser. The resume is never uploaded, there is no
backend, no LLM, and no network request at runtime. Parsing is rule-based, so
it is deterministic, debuggable, free, and works offline.

> **Status: stage 4 of 6.** Upload, parse, review, pick a template, preview,
> download the site as a ZIP. Stage 5 is the ship list: skills data, deploy,
> attribution. See [Build plan](#build-plan).

## Why build it this way

| Decision | Choice | Why |
| --- | --- | --- |
| Runtime | 100% browser, no backend | The resume never leaves the device. Every competitor uploads to a server or an LLM. |
| Parsing | Rule-based feature scoring | Zero cost, zero latency, fully offline, deterministic, debuggable. |
| Accuracy backstop | A mandatory review form | Rule parsing is 80–90% on single-column, 40–60% on multi-column. The form absorbs the gap and turns a weakness into a trust feature. |
| Output | Downloadable ZIP of static code | The user owns and hosts the code. Most rivals only hand back a locked hosted page. |
| Framework | Vite + React + TypeScript | No SSR to fight, trivial static deploy, fastest dev loop. |

## Getting started

```bash
npm install
npm run dev
```

`npm install` runs a postinstall step that copies the pdf.js worker into
`public/`. If you ever see the worker 404 at runtime, run `npm run postinstall`.

| Command | What it does |
| --- | --- |
| `npm run dev` | The app on http://localhost:5173 (`?debug` for the stage-1 overlay) |
| `npm test` | Vitest, once |
| `npm run test:watch` | Vitest, watching |
| `npm run build` | Typecheck then production build |
| `npm run typecheck` | App and test typecheck, no build |
| `npm run fixtures:score` | Per-fixture parser scoreboard |
| `npm run fixtures:update` | Rewrite expected JSON from current parser output |

Then drop resumes into `fixtures/resumes/` and score them — see
[the corpus README](fixtures/resumes/README.md) for how, and for the exit
criterion this stage has to clear.

## Architecture

`resume.json` is the only interface between the two halves of the app. Parsers
write to it; templates read from it. Adding a template touches no parser code.
Adding a parser touches no template code.

```
Upload (PDF / DOCX)
      |
      v
  [ EXTRACT ]   pdf.js getTextContent() -> items with x/y/font
                mammoth extractRawText  -> plain text
      |
      v
  [ LAYOUT  ]   line grouping -> gutter detection -> reading order
      |
      v
  [ SECTION ]   header detection -> { experience, education, skills, ... }
      |
      v
  [ SCORE   ]   feature scoring per field -> value + confidence
      |
      v
  resume.json   <- validated by Zod (SINGLE SOURCE OF TRUTH)
      |
      v
  [ REVIEW  ]   editable form; low-confidence fields flagged
      |
      v
  [ RENDER  ]   resume.json + templateId -> { index.html, styles.css }
      |
      v
  Preview (sandboxed blob iframe)  +  Download ZIP (fflate)
```

### What exists today

```
src/
  schema/resume.ts        Zod schema + inferred types. The contract.
  extract/
    worker-setup.ts       GlobalWorkerOptions.workerSrc, BASE_URL-aware
    pdf.ts                pdf.js -> TextItem[] in top-left coordinates
    docx.ts               mammoth extractRawText -> string
    render.ts             page -> PNG, for the debug overlay only
  layout/
    lines.ts              merge split runs, group by baseline
    columns.ts            x-histogram -> gutter -> left/right partition
    reading-order.ts      detect -> split -> sort -> concatenate
  parse/
    text.ts               the regexes: dates, phone, email, location, GPA
    sections.ts           heading detection -> labelled sections
    subsections.ts        vertical-gap entry splitting
    wrap.ts               fold wrapped bullets back together
    features.ts           the scoring registry: features -> winner + confidence
    from-text.ts          plain text -> Line[], so DOCX shares the engine
    fields/               basics, experience, education, skills, projects, certs
    index.ts              orchestrates -> { data, confidence }
  ui/
    review/               headless: keys, state, adopt, history, selectors,
                          descriptors, export, blocks — all tested without a DOM
    storage/              safe localStorage shim, versioned draft envelope
    hooks/                autosave, the flag walk, shortcuts
    components/           FieldInput, EntryCard, SectionList, SourcePanel, …
    ReviewForm.tsx        the stage-3 screen
    ExportScreen.tsx      the stage-4 screen: picker, preview, ZIP
    UploadScreen.tsx      file or pasted text
    export/zip.ts         fflate
  templates/
    escape.ts             the html tag; every interpolation escapes
    parts.ts              dateSpan, link, contactItems — shared pieces
    render.ts             registry + README; inlineForPreview
    minimal/ developer/ creative/   each: html.ts, css.ts, meta.ts
    fixtures.ts           FULL, SPARSE, HOSTILE
  spike/                  the stage-1 overlay, behind ?debug
fixtures/
  text/                   invented plain-text resumes (the DOCX shape)
  expected/               what each one must parse to
```

Module boundaries are enforced by convention and worth keeping: extraction
does not know about layout, and layout does not know about pdf.js.

## Gutter detection

A PDF stores text in content-stream order, which for a two-column resume is
frequently not reading order. There is no packaged browser library that fixes
this, so it is the one genuinely unsolved problem in the pipeline — and the
reason this stage exists before any UI work.

The approach:

1. Build a histogram of horizontal text coverage across the page at 1-point
   resolution. Every item increments every bucket it spans.
2. Take the widest zero-valued run whose centre sits in the middle 60% of the
   page and which is wider than ~3% of page width. A run near either edge is a
   margin; a narrow one is word spacing or a tab stop.
3. Retry with progressively more of the page top held out, up to 35%. A
   full-width header fills exactly the buckets a gutter would occupy and
   otherwise hides it completely.
4. Reject the candidate unless both sides carry a real share of the items and
   at least three lines each.
5. **Reject if most lines straddle the gap.** This is the check that matters.
   A line like `Company Name .......... Jan 2020 – Present` leaves a wide band
   of whitespace down the middle of the page, and a histogram cannot tell it
   from a gutter. The difference is in the lines, not the whitespace: in a
   tabbed layout nearly every line has content on both sides; in a real
   two-column layout the columns have independent leading, so lines spanning
   both sides are coincidental.
6. **Unless the gap is tight.** Some two-column resumes do align their rows
   across the gutter. What still separates them from a tabbed layout is width:
   a typographic gutter is a deliberate 15–40pt, while tab-stop slack runs
   150–250pt. So a high straddle ratio is forgiven below ~49pt.

Then: full-width items first, the whole left column, the whole right column.
Columns are emitted whole rather than interleaved by vertical position — a
sidebar and a main column are separate documents that happen to share a sheet
of paper, and interleaving them by `y` would cut a work entry in half to
insert a skills heading.

Every threshold above is biased toward answering "single column". The failure
modes are not symmetric: a two-column page read as one produces interleaved
but locally coherent text that a human can repair in the review form, while a
single-column page wrongly split scrambles every entry into fragments that
belong to nothing.

### Layouts this is expected to fail on

Known and accepted, in rough order of how often you will hit them:

- **Three or more columns.** Detection finds one gutter and stops. A
  three-column page will split into "left" and "everything else".
- **Coloured or shaded sidebars.** Often a background rectangle with text
  drawn over it. The geometry still works, but the sidebar frequently has no
  gutter — text runs to the panel edge — so it reads as single.
- **Tables with vertical rules.** Cell padding can produce a gutter-shaped
  gap. If rows align across it, the tight-gutter escape may accept a table as
  a two-column layout.
- **Icon fonts for contact details.** Glyphs come through as `` or nothing,
  and they distort the average character width that line merging depends on.
- **Text in a rotated or vertical block.** The transform is not decomposed, so
  rotated text lands at nonsense coordinates.
- **Scanned or image-only PDFs.** No OCR, by design. These fail with a clear
  message rather than producing junk.
- **Bold detection on PDFs with unnamed fonts.** pdf.js reports a generic
  family like `sans-serif` when the font descriptor carries no usable name,
  and `bold` comes back false for the whole document. Column detection is pure
  geometry and does not care, but section-header detection in stage 2 must not
  rely on bold alone — the keyword fallback is load-bearing.
- **A header that is more than a third of the page.** Held-out band caps at
  35%, past which it would start hiding real content.

## The parser

Rule-based feature scoring, no model. Each field declares a set of feature
functions carrying positive or negative scores; every candidate line in the
field's section is scored against all of them, the highest wins, and how
convincingly it won becomes the confidence the review form shows.

```
Name field                          Score   Why
────────────────────────────────────────────────────────────────
matches /^[a-zA-Z\s.'-]+$/            +3    names are letters
is all uppercase                      +2    common header styling
two to four words                     +2    names are short
contains @                            −4    that is the email
contains a digit                      −4    that is the phone
contains ,                            −4    that is the address
contains /                            −4    that is a URL
```

The negatives do the work. A name is hard to describe positively — "letters
and spaces" also describes a job title — but easy to describe by what it
cannot contain.

### What happens to a resume

1. **Sections.** Headings are found by keyword against a table of ~60 aliases
   ("Work History" → experience), with a structural fallback for short
   all-caps lines the table has never seen. Everything above the first
   heading is the contact block.
2. **Wrapped bullets fold.** A bullet spanning three visual lines is one
   bullet. Geometry decides when it disagrees — outdented is a heading,
   indented is a continuation — and text rules decide when it is silent.
3. **Entries.** Sections split into jobs, degrees, projects on vertical gaps
   larger than the median gap. On the DOCX path, where leading is uniform,
   a heading-after-bullet signal takes over.
4. **Fields.** Each entry's heading lines are split on delimiters and scored.
   Position is a feature: the company is almost always on the line with the
   dates.
5. **Zod.** The result is validated. It never throws — a resume the parser
   cannot read yields an empty-but-valid document with zero confidences,
   and the review form takes it from there.

### DOCX

mammoth's `extractRawText` gives plain text with no geometry. It is turned
into synthetic lines and fed through the same engine, with one adaptation:
a blank line becomes a double-height gap, which is exactly what entry
splitting looks for. The cost is that section detection has only keywords
to go on, and column detection has nothing to do.

### Bold is unreliable — design around it

pdf.js reports a generic font family (`sans-serif`) for many PDFs, and
`bold` comes back `false` for every line in them. Nothing in the parser
*requires* bold: heading detection uses length and case, and the keyword
table is what actually finds sections. Bold is supporting evidence where it
exists and absent without consequence where it does not.

### Known weak spots

- **A project name in capitals** ("VIGIL") alone on its line is detected as
  an unknown heading and splits its section. Harmless to the parsed fields,
  since unknown sections are not parsed, but the review form will show it
  as its own block.
- **Non-standard section names** ("AI Security — Built & Published") land
  in an unknown section rather than projects. Stage 3 lets the user
  reassign them.
- **Right-aligned dates on the role line** rather than the company line
  cost the company its strongest positional feature. It usually still wins
  on the others.
- **Skills written as prose** split on commas like a list would.

## The review form

Rule parsing is 80–90% on single-column resumes and 40–60% on two-column.
The form is what absorbs the gap, and it is designed around one number:
the worst-parsed resume to a correct `resume.json` in under two minutes.

### What makes it fast

**The flag walk.** On load, focus lands in the first field the parser was
unsure about. Cmd/Ctrl+Enter means "looks right, next"; typing means "here
is the answer". Parser silence counts as a stop too: a job with no company
gets a dashed *Missing* field, because the commonest two-column fault is a
field the parser never wrote at all.

**Lists are one control.** Bullets are a textarea, one per line; skills are
comma-separated. Eight bullets from the source panel are one paste.

**The Source panel.** Every section the parser could not place sits on the
right with *Add to ▾*. A three-project block under a heading the parser has
never seen becomes three project cards in one click, through the same
field parsers the first parse used. Selecting any span of the full text
does the same.

**Undo.** Cmd/Ctrl+Z outside a text field. Repairing a mis-split column is
delete, delete, delete.

### How it is built

Identity, not indices. Every entry gets an id at load and every review
record is keyed by it, so removing an entry is a prefix delete and
reordering touches nothing. The parser's `experience.0.company` becomes
`e1.company` once, in `adopt()`, and no index survives past that point.

Descriptors, not a schema walker. Each section's field table is checked
with `satisfies` against the Zod type at compile time, and a conformance
test walks the schema at test time. Add a field to the schema and `tsc`
fails until the form knows about it.

The working state is allowed to be untidy — `""` in optionals, a trailing
empty bullet. `normalise()` enforces the contract once, at export, and
that parsed value is what templates receive.

Persistence is a versioned envelope in one localStorage key, debounced,
flushed on pagehide, repaired on load, with a quota fallback that drops
the source text before it drops your edits.

### Measuring it

`fixtures/resumes/README.md` has the stopwatch protocol. The reference run
on the worst-case fixture is 8 stops and 4 clicks.

## Templates and export

Three templates, each a pure function from a normalised `Resume` to
`index.html` and `styles.css`. The ZIP adds a `README.md` with deploy steps.
No JavaScript, no external requests, system fonts only; open `index.html`
from the unzipped folder and it works.

| | |
| --- | --- |
| **Minimal** | One quiet column, serif headings, print-first. |
| **Developer** | Sticky rail with contact and skill chips beside the content; mono accents; dark-native. |
| **Creative** | Editorial: display name over a warm band, numbered sections, a timeline, a card grid. |

### The escaping boundary

Every byte of user text that reaches an output file goes through
`src/templates/escape.ts`. Templates build markup with an `html` tagged
template that escapes every interpolated string; only a value already
marked as markup passes through. A template author cannot forget to escape
because there is nothing to remember.

URLs are an allowlist — `http`, `https`, `mailto`, `tel` — never a
blocklist. A bare `github.com/you` gets `https://`; `javascript:`, `data:`
and anything with a control character in it become plain text. Bidi
overrides and C0 controls are stripped at the boundary so no output can
carry the characters that make `moc.live` read as `evil.com`.

`src/templates/fixtures.ts` has a hostile resume with a payload in every
string field. Every template renders it in the test suite, and the output
of every file in the ZIP — README included, since Markdown is rendered — is
checked for live markup.

### The preview

A blob-URL iframe with `sandbox=""`: no scripts, no same-origin, no
navigation, no forms. The site has no scripts, so `allow-scripts` is not
needed — and it must never be combined with `allow-same-origin`, which
would let a sandboxed script reach the parent origin.

## Build plan

| Stage | Goal | Status |
| --- | --- | --- |
| 0 | Scaffold, schema, worker wired | ✅ done |
| 1 | Reading-order spike | ✅ done — awaiting corpus scoring |
| 2 | Parser: sections, subsections, field scoring | ✅ done — 1 real resume at 40/40, 0 flagged |
| 3 | Review form generated from the schema | ✅ done — worst-case fixture in 8 stops + 4 clicks |
| 4 | Templates and ZIP export | ✅ done — 3 templates, hostile-input tested, ZIP opens offline |
| 5 | Ship: skills data, deploy, docs | next |

Out of scope for v1: OCR, three-column and sidebar layouts, LinkedIn import,
one-click deploy, accounts, custom colour theming, multi-page output.

## Deployment notes

`workerSrc` is built from `import.meta.env.BASE_URL`, so the app works both at
a domain root and under a subpath with no code change:

- **Vercel** — zero config, served at `/`.
- **GitHub Pages** — set `base: "/<repo>/"` in `vite.config.ts` and add a
  `.nojekyll` file to the published output.

## Licence notes

Two traps worth knowing about before contributing:

- **OpenResume is AGPL-3.0.** Its parser architecture is excellent prior art
  and the algorithm here is derived from its published documentation. The
  implementation is original TypeScript written from that spec. Do not paste
  in its source, or this project inherits AGPL.
- **Do not bundle EMSI/Lightcast skill data.** It is contract-based, forbids
  redistribution and cannot be relicensed. SkillNer is MIT *code* wrapping
  non-permissive *data*. Use O*NET (CC BY 4.0, attribution required), GitHub
  Linguist (MIT) and devicon (MIT) instead.
