/**
 * Routes between the upload screen and the review form, and owns the one
 * piece of state that outlives both: the history-wrapped review state,
 * initialised from a saved draft if there is one.
 *
 * The stage-1 spike stays reachable at ?debug until stage 4 deletes it;
 * the overlay is still the fastest way to see why a PDF read the way it did.
 */
import { useCallback, useMemo, useReducer, useState } from "react";
import { SpikeApp } from "./spike/SpikeApp";
import { ReviewForm } from "./ui/ReviewForm";
import { UploadScreen } from "./ui/UploadScreen";
import { useDraftPersistence } from "./ui/hooks/useDraftPersistence";
import type { Parsed } from "./ui/parseFile";
import { initialHistory, reviewHistoryReducer, type HistoryState } from "./ui/review/history";
import { initialState } from "./ui/review/state";
import { clearDraft, DRAFT_KEY, parseDraft } from "./ui/storage/draft";
import { getLocalStorage, safeGet } from "./ui/storage/safeStorage";
import "./ui/review.css";

interface Boot {
  history: HistoryState;
  restoredAt: string | null;
  restoreFailed: boolean;
}

function boot(storage: ReturnType<typeof getLocalStorage>): Boot {
  const raw = storage ? safeGet(storage, DRAFT_KEY) : null;
  if (raw === null) return { history: initialHistory(initialState()), restoredAt: null, restoreFailed: false };
  const draft = parseDraft(raw);
  if (!draft) return { history: initialHistory(initialState()), restoredAt: null, restoreFailed: true };
  return { history: initialHistory(draft.state), restoredAt: draft.savedAt, restoreFailed: false };
}

export default function App() {
  if (new URLSearchParams(window.location.search).has("debug")) return <SpikeApp />;
  return <ReviewApp />;
}

function ReviewApp() {
  const storage = useMemo(() => getLocalStorage(), []);
  const [initial] = useState(() => boot(storage));
  const [history, dispatch] = useReducer(reviewHistoryReducer, initial.history);
  const { status, flush } = useDraftPersistence(history.present, storage);
  const [pendingReplace, setPendingReplace] = useState<Parsed | null>(null);
  const [restoreFailed, setRestoreFailed] = useState(initial.restoreFailed);
  const [uploadingAnother, setUploadingAnother] = useState(false);

  const load = useCallback(
    (parsed: Parsed) => {
      dispatch({ type: "LOAD_PARSE", result: parsed.result, source: parsed.source });
      setPendingReplace(null);
      setUploadingAnother(false);
      setRestoreFailed(false);
    },
    [dispatch],
  );

  const onParsed = (parsed: Parsed) => {
    // A dirty draft is real work; replacing it silently would be the one
    // thing this app must never do. An inline banner, not window.confirm.
    if (history.present.source !== null && history.present.dirty) setPendingReplace(parsed);
    else load(parsed);
  };

  const startOver = () => {
    if (storage) clearDraft(storage);
    dispatch({ type: "RESET" });
    setUploadingAnother(false);
  };

  const state = history.present;
  const sourceMissing = state.source !== null && state.source.text === "" && state.source.format !== "text";

  if (state.source === null || uploadingAnother) {
    return (
      <div className="rf">
        {uploadingAnother && (
          <div className="rf-banner" style={{ margin: "1rem 1.5rem 0" }}>
            <span>Your current draft of <strong>{state.source?.fileName}</strong> is kept until you load a new file.</span>
            <button type="button" className="rf-btn rf-btn-small" onClick={() => setUploadingAnother(false)}>
              Back to it
            </button>
          </div>
        )}
        {pendingReplace && (
          <div className="rf-banner rf-banner-warn" style={{ margin: "1rem 1.5rem 0" }}>
            <span>
              You have edits to <strong>{state.source?.fileName}</strong>. Replace with{" "}
              <strong>{pendingReplace.source.fileName}</strong>?
            </span>
            <button type="button" className="rf-btn rf-btn-primary rf-btn-small" onClick={() => load(pendingReplace)}>
              Replace
            </button>
            <button type="button" className="rf-btn rf-btn-small" onClick={() => setPendingReplace(null)}>
              Keep current
            </button>
          </div>
        )}
        <UploadScreen onParsed={onParsed} restoreFailed={restoreFailed} />
      </div>
    );
  }

  return (
    <ReviewForm
      key={state.loadSeq}
      history={history}
      dispatch={dispatch}
      status={status}
      flush={flush}
      restoredAt={initial.restoredAt}
      sourceMissing={sourceMissing}
      onUploadAnother={() => setUploadingAnother(true)}
      onStartOver={startOver}
    />
  );
}
