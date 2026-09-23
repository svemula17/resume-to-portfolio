/**
 * One SectionDef → a heading, its cards, and an Add button.
 *
 * Generic over the list path so the six sections and the links list are
 * one component with no per-section code. The type is bound once here;
 * EntryCard reads fields through the descriptor table and never needs to
 * know which section it is in.
 */
import { useRef } from "react";
import { isFlagged } from "../review/adopt";
import { SECTIONS } from "../review/descriptors";
import type { ListPath } from "../review/keys";
import { listOf, type ListEntry } from "../review/lists";
import { peekEntryId } from "../review/state";
import { useAnnounce } from "../hooks/useAnnounce";
import { AddFromText } from "./AddFromText";
import { EntryCard } from "./EntryCard";
import { FlagChip } from "./FlagChip";
import { useReview } from "./review-context";

interface Props<P extends ListPath> {
  path: P;
  compact?: boolean;
}

export function SectionList<P extends ListPath>({ path, compact }: Props<P>) {
  const { state, dispatch, focusEntry } = useReview();
  const announce = useAnnounce();
  const rootRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const section = SECTIONS[path];
  const items = listOf(state.resume, path) as readonly ListEntry[];
  const ids = state.entryIds[path];

  const add = () => {
    const id = peekEntryId(state, path);
    dispatch({ type: "ADD_ENTRY", path });
    focusEntry(id);
    announce(`Added ${section.singular}.`);
  };

  const onRemoved = (index: number) => {
    // Next card, else previous, else the Add button — never nowhere.
    const remaining = ids.filter((_, i) => i !== index);
    const target = remaining[index] ?? remaining[index - 1];
    if (target) {
      const header = rootRef.current?.querySelector<HTMLElement>(
        `[data-entry-id="${target}"] [data-entry-header]`,
      );
      header?.focus();
    } else {
      addRef.current?.focus();
    }
  };

  const onImported = () => {
    // importEntries mints ids from nextId at the time of dispatch; the first
    // new one is the id the peek would have produced.
    focusEntry(peekEntryId(state, path));
  };

  const groupKey = path === "basics.links" ? ("basics.links" as const) : null;
  const groupRecord = groupKey ? state.review[groupKey] : undefined;

  return (
    <section className="rf-section" ref={rootRef} aria-label={section.label}>
      <div className="rf-section-head">
        <h2>{section.label}</h2>
        <span className="rf-section-count">{items.length}</span>
        {groupKey && groupRecord && (
          <span data-fkey={groupKey}>
            <FlagChip
              record={groupRecord}
              flagged={isFlagged(groupRecord)}
              missing={false}
              onReview={() => dispatch({ type: "MARK_REVIEWED", key: groupKey })}
              onReflag={() => dispatch({ type: "REFLAG", key: groupKey })}
            />
          </span>
        )}
        <div className="rf-section-actions">
          {path !== "basics.links" && (
            <AddFromText path={path as Exclude<ListPath, "basics.links">} onAdded={onImported} />
          )}
          <button ref={addRef} type="button" className="rf-btn rf-btn-small" onClick={add}>
            Add {section.singular}
          </button>
        </div>
      </div>

      {ids.map((id, index) => (
        <EntryCard
          key={id}
          path={path}
          id={id}
          entry={items[index]!}
          index={index}
          count={ids.length}
          compact={compact}
          onRemoved={onRemoved}
        />
      ))}
    </section>
  );
}
