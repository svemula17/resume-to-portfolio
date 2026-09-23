/**
 * One list entry: a focusable header and a grid of its fields.
 *
 * The header is the keyboard target for structural work. It is focusable,
 * and on it Delete removes, Enter toggles, Alt+Arrow moves; Escape from any
 * field inside lands here. Cards start collapsed when they have no flags so
 * the worst-parsed resume shows exactly the work, and the flag walk expands
 * a card before focusing into it.
 *
 * Keyed by EntryId at the call site, so a move relocates the DOM node and
 * focus and caret survive the reorder.
 */
import { useEffect, useRef } from "react";
import { isFlagged } from "../review/adopt";
import { SECTIONS, type FieldDescriptor } from "../review/descriptors";
import { fieldKey, type EntryId, type ListPath } from "../review/keys";
import { readField, type ListEntry } from "../review/lists";
import { entryFlagCount, isSeededMissing } from "../review/selectors";
import { useAnnounce } from "../hooks/useAnnounce";
import { FieldInput } from "./FieldInput";
import { useReview } from "./review-context";

interface Props {
  path: ListPath;
  id: EntryId;
  entry: ListEntry;
  index: number;
  count: number;
  compact?: boolean;
  /** Called after a remove so the section can move focus sensibly. */
  onRemoved: (index: number) => void;
}

export function EntryCard({ path, id, entry, index, count, compact, onRemoved }: Props) {
  const { state, dispatch, issuesByKey, touched, markTouched, showAllIssues, isCollapsed, setCollapsed } =
    useReview();
  const announce = useAnnounce();
  const headerRef = useRef<HTMLDivElement>(null);
  const section = SECTIONS[path];
  const fields = section.fields as Record<string, FieldDescriptor>;
  const title = (section.title as (item: ListEntry) => string)(entry);
  const flags = entryFlagCount(state, id);
  const collapsed = isCollapsed(id);
  const movedRef = useRef(false);

  // After a move, keep the card in view. Only after a move this card asked
  // for: a remove above shifts every following card's index too, and
  // scrolling on each of those would drag the viewport to the last one.
  useEffect(() => {
    if (!movedRef.current) return;
    movedRef.current = false;
    headerRef.current?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const move = (delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= count) return;
    // The button that was clicked disables itself at either end, and a
    // disabled element cannot hold focus: keep it on the card.
    if (target === 0 || target === count - 1) headerRef.current?.focus();
    movedRef.current = true;
    dispatch({ type: "MOVE_ENTRY", id, delta });
    announce(`Moved to position ${target + 1} of ${count}`);
  };

  const remove = () => {
    dispatch({ type: "REMOVE_ENTRY", id });
    announce(`Removed ${title}. Undo with Command or Control Z.`);
    onRemoved(index);
  };

  const onHeaderKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      remove();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setCollapsed(id, !collapsed);
    }
  };

  const onCardKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // The bare chord only. Alt+Shift+Arrow is select-to-paragraph on macOS
    // and must keep working inside a bullets textarea.
    const bareAlt = event.altKey && !event.shiftKey && !event.metaKey && !event.ctrlKey;
    if (bareAlt && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      move(event.key === "ArrowUp" ? -1 : 1);
    } else if (event.key === "Escape" && event.target !== headerRef.current) {
      event.preventDefault();
      headerRef.current?.focus();
    }
  };

  return (
    <div
      className={`rf-card${flags > 0 ? " rf-card-flagged" : ""}`}
      data-entry-id={id}
      onKeyDown={onCardKey}
    >
      <div
        ref={headerRef}
        className="rf-card-head"
        role="group"
        tabIndex={0}
        aria-label={title}
        data-entry-header
        onKeyDown={onHeaderKey}
      >
        <button
          type="button"
          className="rf-disclosure"
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          onClick={() => setCollapsed(id, !collapsed)}
          tabIndex={-1}
        />
        <span className="rf-card-title">{title}</span>
        {flags > 0 && (
          <span className="rf-card-badge">
            {flags}
            <span className="sr-only"> to review</span>
          </span>
        )}
        <div className="rf-card-actions">
          {flags > 0 && (
            <button
              type="button"
              className="rf-btn rf-btn-quiet rf-btn-small"
              onClick={() => {
                // This button hides itself once the entry has no flags.
                headerRef.current?.focus();
                dispatch({ type: "MARK_ENTRY_REVIEWED", id });
              }}
              aria-label={`Looks right: ${title}`}
              title="Mark every flagged field in this entry as looks right"
            >
              Looks right
            </button>
          )}
          <button
            type="button"
            className="rf-btn rf-btn-quiet rf-btn-small"
            onClick={() => move(-1)}
            disabled={index === 0}
            aria-label={`Move up: ${title}`}
            title="Move up (Alt+↑)"
          >
            ↑
          </button>
          <button
            type="button"
            className="rf-btn rf-btn-quiet rf-btn-small"
            onClick={() => move(1)}
            disabled={index === count - 1}
            aria-label={`Move down: ${title}`}
            title="Move down (Alt+↓)"
          >
            ↓
          </button>
          <button
            type="button"
            className="rf-btn rf-btn-quiet rf-btn-small"
            onClick={remove}
            aria-label={`Remove: ${title}`}
            title="Remove (Delete on the header)"
          >
            ✕
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className={`rf-card-body${compact ? " rf-card-body-compact" : ""}`}>
          <div className="rf-grid">
            {Object.entries(fields).map(([name, descriptor]) => {
              const key = fieldKey(id, name);
              const record = state.review[key];
              const flagged = isFlagged(record);
              return (
                <FieldInput
                  key={name}
                  fieldKey={key}
                  descriptor={descriptor}
                  value={readField(entry, name)}
                  disabledBy={descriptor.disabledWhen ? readField(entry, descriptor.disabledWhen) : undefined}
                  record={record}
                  flagged={flagged}
                  missing={flagged && isSeededMissing(state, key)}
                  issue={issuesByKey.get(key)}
                  showIssue={showAllIssues || touched.has(key)}
                  onChange={(value) => dispatch({ type: "SET_FIELD", key, value })}
                  onReview={() => dispatch({ type: "MARK_REVIEWED", key })}
                  onReflag={() => dispatch({ type: "REFLAG", key })}
                  onBlur={() => markTouched(key)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
