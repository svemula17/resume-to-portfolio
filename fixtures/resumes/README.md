# Test corpus

Drop resume PDFs and DOCX files in this directory.

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
