/**
 * "Add to ▾": parse some text into a section and import it.
 *
 * Shared by the block cards and the full-text selection toolbar. A plain
 * button-and-list rather than a native <select>, because the action fires
 * on choice and a select's change event on keyboard navigation would fire
 * on every arrow key.
 */
import { useEffect, useId, useRef, useState } from "react";
import { parseBlockAs, type ImportTarget } from "../review/blocks";
import { SECTIONS } from "../review/descriptors";
import type { BlockId } from "../review/keys";
import { useAnnounce } from "../hooks/useAnnounce";
import { useReview } from "./review-context";

const TARGETS: ImportTarget[] = ["experience", "education", "projects", "skills", "certifications"];

interface Props {
  text: string;
  heading?: string;
  blockId?: BlockId;
  onDone?: () => void;
}

export function AddToMenu({ text, heading, blockId, onDone }: Props) {
  const { dispatch } = useReview();
  const announce = useAnnounce();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (target: ImportTarget | "summary") => {
    setOpen(false);
    if (target === "summary") {
      dispatch({ type: "APPEND_SUMMARY", text, blockId });
      announce("Added to summary.");
    } else {
      const entries = parseBlockAs(target, text, heading);
      if (entries.length === 0) {
        announce("Nothing to add.");
        return;
      }
      dispatch({ type: "IMPORT_ENTRIES", path: target, entries, blockId } as Parameters<typeof dispatch>[0]);
      const singular = SECTIONS[target].singular;
      announce(`Added ${entries.length} ${entries.length === 1 ? singular : `${singular}s`} to ${SECTIONS[target].label}.`);
    }
    onDone?.();
  };

  return (
    <div className="rf-menu" ref={menuRef}>
      <button
        type="button"
        className="rf-btn rf-btn-small"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        Add to ▾
      </button>
      {open && (
        <ul className="rf-menu-list" role="menu" id={id}>
          {TARGETS.map((target) => (
            <li key={target} role="none">
              <button type="button" role="menuitem" onClick={() => choose(target)}>
                {SECTIONS[target].label}
              </button>
            </li>
          ))}
          <li role="none">
            <button type="button" role="menuitem" onClick={() => choose("summary")}>
              Summary
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
