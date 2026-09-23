# Text fixtures

Plain-text resumes, one per file, with the expected parse in
`../expected/<name>.json`. These exercise the DOCX path — mammoth's
`extractRawText` produces exactly this shape — and they are the only fixtures
that can be committed, since they are invented rather than real.

`src/parse/fixtures.test.ts` parses every file here and diffs the result
against its expected JSON. A parser change that alters the output of any
fixture fails the test, which is the point: parser changes become a diff to
review, not a vibe.

## Adding one

1. Write the resume as plain text. Blank lines between entries matter — they
   are the only entry-boundary signal this path has.
2. Run `npm run fixtures:update` to write `expected/<name>.json`.
3. **Read the JSON.** The update script records what the parser produced, not
   what is correct. If it is wrong, fix the parser, not the fixture.

## Scoreboard

`npm run fixtures:score` prints, per fixture, how many expected fields the
parser got right. That number is what tracks whether the parser is actually
improving, and it should only ever go up.
