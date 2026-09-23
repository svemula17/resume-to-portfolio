/**
 * The first screen: a file, or pasted text.
 *
 * Paste exists for two reasons. It is how the stopwatch protocol runs
 * without a corpus, and it is the fastest path for someone whose resume
 * is in a Google Doc — select all, copy, paste — with no export step.
 */
import { useId, useRef, useState } from "react";
import { parseFile, parsePastedText, type Parsed } from "./parseFile";

interface Props {
  onParsed: (parsed: Parsed) => void;
  /** A draft that could not be restored; a one-line notice, then gone. */
  restoreFailed: boolean;
}

export function UploadScreen({ onParsed, restoreFailed }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
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
    <main className="rf-upload">
      <h1>Resume → Portfolio</h1>
      <p>
        Private, offline, no AI. Your resume never leaves your browser. You verify every field. You
        download the full source code.
      </p>

      {restoreFailed && <div className="rf-banner rf-banner-warn">A previous draft couldn't be restored.</div>}

      <div className="rf-upload-box">
        <h2>
          <label htmlFor={fileId}>Upload a PDF or DOCX</label>
        </h2>
        <input
          id={fileId}
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        {busy && <p className="rf-hint">Parsing…</p>}
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
    </main>
  );
}
