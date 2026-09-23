/**
 * Sticky header: where the walk is, what is still wrong, and the exits.
 *
 * Two counts, never merged. Flags are amber and mean "the parser was
 * unsure"; issues are red and mean "the schema rejects this". Resolving a
 * flag never hides an issue, and the download is never disabled — with
 * issues it focuses the first one instead.
 */
import type { AutosaveStatus } from "../hooks/useDraftPersistence";

interface Props {
  fileName: string;
  flagCount: number;
  issueCount: number;
  onPrev: () => void;
  onNext: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  status: AutosaveStatus;
  onUploadAnother: () => void;
  onStartOver: () => void;
  onDownload: () => void;
}

function relative(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} h ago`;
}

function StatusLine({ status }: { status: AutosaveStatus }) {
  switch (status.kind) {
    case "saved":
      return <span className="rf-status">Saved {relative(status.at)}</span>;
    case "saving":
      return <span className="rf-status">Saving…</span>;
    case "reduced":
      return (
        <span className="rf-status rf-status-off" title="localStorage is full; the source text was left out.">
          Saved without source text (storage full)
        </span>
      );
    case "off":
      return (
        <span className="rf-status rf-status-off">
          {status.reason === "quota" ? "Not saving — storage full" : "Not saving — storage unavailable"}
        </span>
      );
    case "foreign":
      return (
        <span className="rf-status rf-status-foreign">
          This draft changed in another tab ·{" "}
          <button type="button" className="rf-btn rf-btn-small" onClick={() => window.location.reload()}>
            Reload
          </button>
        </span>
      );
  }
}

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = IS_MAC ? "⌘" : "Ctrl";

export function ReviewHeader({
  fileName,
  flagCount,
  issueCount,
  onPrev,
  onNext,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  status,
  onUploadAnother,
  onStartOver,
  onDownload,
}: Props) {
  return (
    <header className="rf-header">
      <h1>
        Review <span className="rf-file">· {fileName}</span>
      </h1>

      <div className="rf-walk" role="group" aria-label="Review progress">
        <span className="rf-count">
          {flagCount > 0 ? (
            <span className="rf-count-flag">{flagCount} to review</span>
          ) : (
            <span>Nothing left to review</span>
          )}
        </span>
        <button type="button" className="rf-btn rf-btn-small" onClick={onPrev} disabled={flagCount === 0} aria-label="Previous flagged field">
          ‹
        </button>
        <button type="button" className="rf-btn rf-btn-small" onClick={onNext} disabled={flagCount === 0} aria-label="Next flagged field">
          ›
        </button>
        {issueCount > 0 && (
          <span className="rf-count rf-count-issue">
            {issueCount} {issueCount === 1 ? "issue" : "issues"}
          </span>
        )}
      </div>

      <span className="rf-hint" aria-hidden="true">
        {MOD}↩ looks right, next · {MOD}⇧↩ back · ⌥↑↓ move · {MOD}Z undo
      </span>

      <div className="rf-walk">
        <button type="button" className="rf-btn rf-btn-small" onClick={onUndo} disabled={!canUndo} aria-label="Undo">
          Undo
        </button>
        <button type="button" className="rf-btn rf-btn-small" onClick={onRedo} disabled={!canRedo} aria-label="Redo">
          Redo
        </button>
      </div>

      <StatusLine status={status} />

      <div className="rf-walk">
        <button type="button" className="rf-btn rf-btn-small" onClick={onUploadAnother}>
          Upload another
        </button>
        <button type="button" className="rf-btn rf-btn-small" onClick={onStartOver}>
          Start over
        </button>
        <button type="button" className="rf-btn rf-btn-primary rf-btn-small" onClick={onDownload}>
          Download resume.json
        </button>
      </div>
    </header>
  );
}
