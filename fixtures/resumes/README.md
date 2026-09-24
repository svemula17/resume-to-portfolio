# Test corpus

Drop resume PDFs and DOCX files in this directory.

> There is also a **scored synthetic corpus** in `../corpus/` — invented
> people through seven real-world layouts, scored automatically against
> known truth with `npm run corpus:score`. It found most of the parser's
> defects. It cannot find the ones only real files have; that is what this
> directory is for.

The files themselves are gitignored — they are personal documents, and a
public repository is the wrong place for other people's phone numbers. Only
this README is tracked.

## What to collect

The build plan calls for **15–20 resumes**, and the mix matters more than the
count. A corpus of twenty single-column resumes will tell you the parser is
excellent and teach you nothing.

Aim for roughly:

- 8–10 single-column, the ordinary case
- 5–6 two-column or sidebar layouts
- 2–3 heavily designed ones — coloured sidebars, icon glyphs, tables
- 1 scanned or image-only PDF, to confirm it fails loudly rather than quietly
- 1–2 DOCX, to exercise the mammoth path

## How to score reading order

This is the go/no-go gate for the whole project, so score it by hand and
write the number down.

1. `npm run dev`, upload the resume, read the reconstructed text.
2. Ask one question: **does it read in the order a human would read it?**
   Not "is every character right" — mis-split words are a stage 2 problem.
3. Mark the resume pass or fail. A resume where one heading landed in the
   wrong place is a fail; be strict, the number is only useful if it is.

Exit criterion from the build plan: **single-column ≥ 90%, two-column ≥ 60%**.
If two-column lands below 60%, descope it in the UI and move to stage 2
anyway — the single-column path alone is a shippable product.

When something fails, turn on the debug overlay before changing any code.
The gutter band shows what the histogram found; the numbered line boxes show
the order it read them in. Wherever the numbers jump is the bug.

## Stage 3 — the stopwatch protocol

The stage-3 exit criterion is "the worst-parsed resume in the corpus to a
correct `resume.json` in under two minutes". Until there is a corpus,
`fixtures/text/worst-two-column.txt` stands in. It is an invented resume — no
real person — that reproduces every known failure at once: no name line, a
job with no company, a sidebar swallowed into the experience section, a
three-project block under a non-standard heading, a caps project name that
became its own heading, a flat skills list, two certifications on one line.

Run it like this, every time the form changes:

1. `npm run dev`, open the app, **Start over** if a draft is loaded.
2. Open the fixture, select all, copy. Paste into "Or paste the text", press
   **Parse text**.
3. **Start the clock when the first field takes focus.**
4. Work the walk. Cmd/Ctrl+Enter is "looks right, next"; type to fix. Use
   **Add to ▾** on every unplaced block. Delete cards that are wrong.
5. **Stop the clock when Download produces a file** and this checklist holds:
   - name is `Alex Rivera`
   - the first job has a company
   - Initech is a job, not a leftover
   - four projects: Vigil, Sandbox Harness, Red Team Corpus, VIGIL
     (then delete the duplicate — that is part of the time)
   - a `Languages` skill group exists
   - three certifications
   - zero flags, zero issues
6. Record **time** and **stop count** (every Cmd+Enter is one stop).

Reference run, scripted in a browser with no human latency: 8 stops, 4 Add
to ▾ clicks, 3 removes. Target for a human: ≤ 2:00. If a run misses:

- Over ~15 stops → drop `role` from the core set in `descriptors.ts`.
- Entries merging on Add to ▾ → extend the `loose` split in
  `src/parse/index.ts`; do not build a split tool.
- Time lost hunting for a field → the walk is wrong, not the parser.
