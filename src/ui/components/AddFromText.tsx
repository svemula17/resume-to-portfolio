/**
 * Paste a block, get parsed entries — on every section.
 *
 * The repair for the commonest two-column failure the Source panel cannot
 * reach: two jobs merged into one card. Paste the tail here, get a parsed
 * entry, delete the tail lines from the first card's bullets. No bespoke
 * "split here" tool: a split spans heading inputs and a textarea and is a
 * parse, and the parse already exists.
 */
import { useId, useState } from "react";
import { parseBlockAs, type ImportTarget } from "../review/blocks";
import { SECTIONS } from "../review/descriptors";
import { useAnnounce } from "../hooks/useAnnounce";
import { useReview } from "./review-context";

interface Props {
  path: ImportTarget;
  /** Called with the number of entries added, so the section can focus the first. */
  onAdded: (count: number) => void;
}

export function AddFromText({ path, onAdded }: Props) {
  const { dispatch } = useReview();
  const announce = useAnnounce();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const id = useId();
  const singular = SECTIONS[path].singular;

  const submit = () => {
    const entries = parseBlockAs(path, text);
    if (entries.length === 0) {
      announce("Nothing to add — the text was empty.");
      return;
    }
    dispatch({ type: "IMPORT_ENTRIES", path, entries } as Parameters<typeof dispatch>[0]);
    announce(`Added ${entries.length} ${entries.length === 1 ? singular : `${singular}s`}.`);
    setText("");
    setOpen(false);
    onAdded(entries.length);
  };

  if (!open) {
    return (
      <button type="button" className="rf-btn rf-btn-quiet rf-btn-small" onClick={() => setOpen(true)}>
        Add from text…
      </button>
    );
  }

  return (
    <div className="rf-addtext">
      <label htmlFor={id} className="rf-field-label">
        Paste text to parse as {singular === "skill group" ? "skills" : `a ${singular}`}
      </label>
      <textarea
        id={id}
        className="rf-textarea"
        value={text}
        autoFocus
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            submit();
          }
        }}
      />
      <div className="rf-block-actions">
        <button type="button" className="rf-btn rf-btn-primary rf-btn-small" onClick={submit} disabled={text.trim() === ""}>
          Parse as {singular}
        </button>
        <button type="button" className="rf-btn rf-btn-small" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
