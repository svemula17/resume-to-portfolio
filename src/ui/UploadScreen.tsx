/**
 * The front door: what this is, why it is different, and the file input.
 *
 * The copy leads with privacy because that is the product. Every rival
 * uploads the resume to a server or an LLM; this one cannot, and the page
 * says so in the first line, then proves it in the footer with the only
 * network request the app ever makes — none.
 *
 * Paste exists for two reasons. It is how the stopwatch protocol runs
 * without a corpus, and it is the fastest path for someone whose resume is
 * in a Google Doc — select all, copy, paste — with no export step.
 */
import { useId, useRef, useState } from "react";
import { parseFile, parsePastedText, warmExtractors, type Parsed } from "./parseFile";

interface Props {
  onParsed: (parsed: Parsed) => void;
  /** A draft that could not be restored; a one-line notice, then gone. */
  restoreFailed: boolean;
}

const REPO_URL = "https://github.com/svemula17/resume-to-portfolio";

export function UploadScreen({ onParsed, restoreFailed }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const textId = useId();
  const fileId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      onParsed(await parseFile(file));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleText = () => {
    if (text.trim() === "") return;
    setError(null);
    onParsed(parsePastedText(text));
  };

  return (
    <div className="rf-landing">
      <main className="rf-upload">
        <header className="rf-hero">
          <p className="rf-eyebrow">Resume → Portfolio</p>
          <h1>Your resume becomes a website. It never leaves your browser.</h1>
          <p className="rf-lede">
            Upload a PDF or DOCX. It is parsed here, on your machine — no server, no AI, no
            account. You check every field, pick a template, and download the site's source
            code. Then you own it.
          </p>
        </header>

        {restoreFailed && <div className="rf-banner rf-banner-warn">A previous draft couldn't be restored.</div>}

        <div
          className={`rf-upload-box rf-dropzone${dragging ? " rf-dropzone-active" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files[0];
            if (file) void handleFile(file);
          }}
        >
          <h2>
            <label htmlFor={fileId}>Upload a PDF or DOCX</label>
          </h2>
          <p className="rf-hint">Drop it here, or choose a file.</p>
          <input
            id={fileId}
            ref={inputRef}
            type="file"
            accept=".pdf,.docx"
            disabled={busy}
            onFocus={warmExtractors}
            onMouseEnter={warmExtractors}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          {busy && (
            <p className="rf-hint" role="status">
              Reading the file…
            </p>
          )}
        </div>

        <div className="rf-upload-box">
          <h2>
            <label htmlFor={textId}>Or paste the text</label>
          </h2>
          <textarea
            id={textId}
            className="rf-textarea"
            value={text}
            placeholder="Select all in your resume, copy, paste here."
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") handleText();
            }}
          />
          <button type="button" className="rf-btn rf-btn-primary" onClick={handleText} disabled={text.trim() === ""}>
            Parse text
          </button>
        </div>

        {error && (
          <p className="rf-error" role="alert">
            {error}
          </p>
        )}

        <section className="rf-how" aria-labelledby="how-h">
          <h2 id="how-h">How it works</h2>
          <ol>
            <li>
              <strong>Parse.</strong> Rules, not a model. Sections, dates, bullets and skills are
              found by pattern — deterministic, instant, offline.
            </li>
            <li>
              <strong>Review.</strong> Every field the parser was unsure about is flagged. Walk
              them with one keystroke each; type to fix. Nothing ships unchecked.
            </li>
            <li>
              <strong>Download.</strong> Three templates, one ZIP: <code>index.html</code>,{" "}
              <code>styles.css</code>, a README with deploy steps. No JavaScript in the site, no
              external requests, no tracking. Host it anywhere.
            </li>
          </ol>
        </section>

        <section className="rf-privacy" aria-labelledby="privacy-h">
          <h2 id="privacy-h">What "private" means here</h2>
          <ul>
            <li>The file is read by code running in this tab. It is not uploaded anywhere.</li>
            <li>There are no analytics and no third-party scripts. The page makes no network requests after it loads.</li>
            <li>Your draft is saved in this browser's local storage so a refresh does not lose it. "Start over" deletes it.</li>
            <li>
              The code is open. <a href={REPO_URL} rel="noopener">Read it on GitHub</a>.
            </li>
          </ul>
        </section>
      </main>

      <footer className="rf-footer">
        <p>
          Skills vocabulary: this product includes information from the{" "}
          <a href="https://www.onetcenter.org/" rel="noopener">
            O*NET 29.1 Database
          </a>{" "}
          by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA), used
          under the CC BY 4.0 license — O*NET® is a trademark of USDOL/ETA — together with{" "}
          <a href="https://github.com/github-linguist/linguist" rel="noopener">
            GitHub Linguist
          </a>{" "}
          (MIT) and{" "}
          <a href="https://github.com/devicons/devicon" rel="noopener">
            devicon
          </a>{" "}
          (MIT).
        </p>
        <p>
          Resume → Portfolio is MIT licensed. <a href={REPO_URL} rel="noopener">Source</a>.
        </p>
      </footer>
    </div>
  );
}
