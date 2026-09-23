/**
 * The stage-3 screen.
 *
 * Owns the per-document UI state — which cards are collapsed, which fields
 * have been touched, whether a download has been attempted — and is keyed
 * on loadSeq by App so all of it resets when a new document loads.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import { AnnouncerProvider } from "./components/Announcer";
import { BasicsPanel } from "./components/BasicsPanel";
import { ReviewHeader } from "./components/ReviewHeader";
import { SectionList } from "./components/SectionList";
import { SourcePanel } from "./components/SourcePanel";
import { ReviewContext, type ReviewContextValue } from "./components/review-context";
import { downloadText } from "./download";
import { useAnnounce } from "./hooks/useAnnounce";
import type { AutosaveStatus } from "./hooks/useDraftPersistence";
import { useFlagQueue } from "./hooks/useFlagQueue";
import { useShortcuts } from "./hooks/useShortcuts";
import { isFlagged } from "./review/adopt";
import { issues, toResumeJson } from "./review/export";
import type { HistoryAction, HistoryState } from "./review/history";
import { LIST_PATHS, SECTION_ORDER, type EntryId, type FieldKey } from "./review/keys";
import { entryFlagCount, flagCount } from "./review/selectors";
import { reviewReducer, type ReviewState } from "./review/state";

interface Props {
  history: HistoryState;
  dispatch: Dispatch<HistoryAction>;
  status: AutosaveStatus;
  flush: () => void;
  restoredAt: string | null;
  sourceMissing: boolean;
  onUploadAnother: () => void;
  onStartOver: () => void;
}

function initialCollapsed(state: ReviewState): Set<EntryId> {
  // Collapsed iff no flags, so the worst-parsed resume shows exactly the work.
  const collapsed = new Set<EntryId>();
  for (const path of LIST_PATHS) {
    for (const id of state.entryIds[path]) {
      if (entryFlagCount(state, id) === 0) collapsed.add(id);
    }
  }
  return collapsed;
}

function Form({ history, dispatch, status, flush, restoredAt, sourceMissing, onUploadAnother, onStartOver }: Props) {
  const state = history.present;
  const announce = useAnnounce();
  const rootRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsedSet] = useState(() => initialCollapsed(state));
  const [touched, setTouched] = useState<Set<FieldKey>>(() => new Set());
  const [showAllIssues, setShowAllIssues] = useState(false);
  const [showRestored, setShowRestored] = useState(restoredAt !== null);

  const issueList = useMemo(() => issues(state), [state]);
  const issuesByKey = useMemo(() => new Map(issueList.map((issue) => [issue.key, issue.message])), [issueList]);
  const flags = useMemo(() => flagCount(state), [state]);

  const setCollapsed = useCallback((id: EntryId, value: boolean) => {
    setCollapsedSet((prev) => {
      if (prev.has(id) === value) return prev;
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const ensureVisible = useCallback((id: EntryId) => setCollapsed(id, false), [setCollapsed]);

  // Entry focus after add or import. The card does not exist until the
  // render after the dispatch, so the request is parked and honoured by an
  // effect keyed on the id lists. Every path that creates entries — Add,
  // Add from text, Add to ▾ from the Source panel — goes through here, so
  // focus never falls to <body> where the shortcuts cannot see it.
  const pendingEntry = useRef<EntryId | null>(null);
  const focusEntry = useCallback(
    (id: EntryId) => {
      setCollapsed(id, false);
      pendingEntry.current = id;
    },
    [setCollapsed],
  );
  useEffect(() => {
    const id = pendingEntry.current;
    if (!id) return;
    const card = rootRef.current?.querySelector<HTMLElement>(`[data-entry-id="${id}"]`);
    if (!card) return;
    pendingEntry.current = null;
    const field = card.querySelector<HTMLElement>("[data-fkey]:not(:disabled)");
    (field ?? card.querySelector<HTMLElement>("[data-entry-header]"))?.focus();
    card.scrollIntoView({ block: "nearest" });
  }, [state.entryIds, collapsed]);

  const walk = useFlagQueue({ state, rootRef, ensureVisible, loadSeq: state.loadSeq });

  const acceptAndNext = useCallback(() => {
    const key = walk.cursor();
    // The search runs over the state as it will be after the mark, not as
    // it is now. Dispatch does not update `state` inside this handler, and
    // searching the pre-mark state from the last flag on the page wraps
    // straight back onto that same flag.
    let after = state;
    if (key && isFlagged(state.review[key])) {
      dispatch({ type: "MARK_REVIEWED", key });
      after = reviewReducer(state, { type: "MARK_REVIEWED", key });
    }
    const next = walk.next(after);
    if (!next) announce("Nothing left to review.");
  }, [walk, state, dispatch, announce]);

  const handlers = useMemo(
    () => ({
      acceptAndNext,
      back: () => {
        walk.prev();
      },
      undo: () => dispatch({ type: "UNDO" }),
      redo: () => dispatch({ type: "REDO" }),
      save: flush,
    }),
    [acceptAndNext, walk, dispatch, flush],
  );
  useShortcuts(rootRef, handlers);

  const download = () => {
    if (issueList.length > 0) {
      setShowAllIssues(true);
      walk.focusKey(issueList[0]!.key);
      announce(`${issueList.length} ${issueList.length === 1 ? "issue" : "issues"} to fix before download.`);
      return;
    }
    flush();
    downloadText(toResumeJson(state), "resume.json");
    announce("Downloaded resume.json.");
  };

  const context: ReviewContextValue = useMemo(
    () => ({
      state,
      dispatch,
      issuesByKey,
      touched,
      markTouched: (key) =>
        setTouched((prev) => {
          if (prev.has(key)) return prev;
          const next = new Set(prev);
          next.add(key);
          return next;
        }),
      showAllIssues,
      isCollapsed: (id) => collapsed.has(id),
      setCollapsed,
      focusEntry,
    }),
    [state, dispatch, issuesByKey, touched, showAllIssues, collapsed, setCollapsed, focusEntry],
  );

  return (
    <ReviewContext.Provider value={context}>
      <div className="rf" ref={rootRef}>
        <ReviewHeader
          fileName={state.source?.fileName ?? "resume"}
          flagCount={flags}
          issueCount={issueList.length}
          onPrev={() => walk.prev()}
          onNext={acceptAndNext}
          canUndo={history.past.length > 0}
          canRedo={history.future.length > 0}
          onUndo={() => dispatch({ type: "UNDO" })}
          onRedo={() => dispatch({ type: "REDO" })}
          status={status}
          onUploadAnother={onUploadAnother}
          onStartOver={onStartOver}
          onDownload={download}
        />

        <div className="rf-body">
          <main className="rf-main">
            {showRestored && restoredAt && (
              <div className="rf-banner">
                <span>
                  Restored your draft of <strong>{state.source?.fileName}</strong>.
                </span>
                <button type="button" className="rf-btn rf-btn-small" onClick={() => setShowRestored(false)}>
                  OK
                </button>
              </div>
            )}

            <BasicsPanel />
            {SECTION_ORDER.map((path) => (
              <SectionList key={path} path={path} />
            ))}
          </main>

          <div className="rf-aside">
            <SourcePanel blocks={state.blocks} sourceText={state.source?.text ?? ""} sourceMissing={sourceMissing} />
          </div>
        </div>
      </div>
    </ReviewContext.Provider>
  );
}

export function ReviewForm(props: Props) {
  return (
    <AnnouncerProvider>
      <Form {...props} />
    </AnnouncerProvider>
  );
}
