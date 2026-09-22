# Resume → Portfolio

Upload a resume, get back the source code for a static portfolio site.

Everything happens in the browser. The resume is never uploaded, there is no
backend, no LLM, and no network request at runtime. Parsing is rule-based, so
it is deterministic, debuggable, free, and works offline.

> **Status: stage 1 of 6.** What exists today is the scaffold and the
> reading-order spike. There is no review form, no templates and no export
> yet — those are stages 3 and 4. See [Build plan](#build-plan).

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
| `npm run dev` | Spike UI on http://localhost:5173 |
| `npm test` | Vitest, once |
| `npm run test:watch` | Vitest, watching |
| `npm run build` | Typecheck then production build |

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
      |             <- you are here
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
  spike/DebugOverlay.tsx  draws the layout decision on the rendered page
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

## Build plan

| Stage | Goal | Status |
| --- | --- | --- |
| 0 | Scaffold, schema, worker wired | ✅ done |
| 1 | Reading-order spike | ✅ done — awaiting corpus scoring |
| 2 | Parser: sections, subsections, field scoring | next |
| 3 | Review form generated from the schema | |
| 4 | Templates and ZIP export | |
| 5 | Ship: skills data, deploy, docs | |

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
