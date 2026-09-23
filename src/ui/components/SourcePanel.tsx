/**
 * The quarry: everything the parser read, available to copy from and to
 * parse into the form.
 *
 * Top: the unplaced blocks — sections the parser recognised but could not
 * map to a field — each with Copy, Add to ▾ and Dismiss. Below: the full
 * reading-order text, where selecting a span shows a floating Add to ▾, for
 * the two-column case where content was mis-sectioned rather than dropped.
 *
 * Read-only. User edits never write back; the panel is where text comes
 * from, not where it goes.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { LeftoverBlock } from "../review/state";
import { useAnnounce } from "../hooks/useAnnounce";
import { AddToMenu } from "./AddToMenu";
import { useReview } from "./review-context";

interface Props {
  blocks: LeftoverBlock[];
  sourceText: string;
  sourceMissing: boolean;
}

async function copyText(text: string, fallback: HTMLTextAreaElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (fallback) {
      fallback.select();
      return document.execCommand("copy");
    }
    return false;
  }
}

function BlockCard({ block }: { block: LeftoverBlock }) {
  const { dispatch } = useReview();
  const announce = useAnnounce();
  const textRef = useRef<HTMLTextAreaElement>(null);

  if (block.status !== "open") {
    return (
      <div className="rf-block rf-block-stub">
        <span>
          {block.heading || "Block"} · {block.status === "used" ? "added" : "dismissed"}
        </span>
        {block.status === "used" ? (
          <button type="button" className="rf-btn rf-btn-quiet rf-btn-small" onClick={() => dispatch({ type: "UNDO" })}>
            Undo
          </button>
        ) : (
          <button
            type="button"
            className="rf-btn rf-btn-quiet rf-btn-small"
            onClick={() => dispatch({ type: "RESTORE_BLOCK", blockId: block.id })}
          >
            Restore
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rf-block">
      <div className="rf-block-head">{block.heading || "Untitled block"}</div>
      <textarea ref={textRef} className="rf-block-text" readOnly value={block.text} aria-label={`Text of ${block.heading}`} />
      <div className="rf-block-actions">
        <AddToMenu text={block.text} heading={block.heading} blockId={block.id} />
        <button
          type="button"
          className="rf-btn rf-btn-small"
          onClick={async () => {
            const ok = await copyText(block.text, textRef.current);
            announce(ok ? "Copied." : "Could not copy — select the text and copy manually.");
          }}
        >
          Copy
        </button>
        <button
          type="button"
          className="rf-btn rf-btn-quiet rf-btn-small"
          onClick={() => dispatch({ type: "DISMISS_BLOCK", blockId: block.id })}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

interface SelectionBar {
  text: string;
  top: number;
  left: number;
}

export function SourcePanel({ blocks, sourceText, sourceMissing }: Props) {
  const preRef = useRef<HTMLPreElement>(null);
  const [selection, setSelection] = useState<SelectionBar | null>(null);
  const announce = useAnnounce();
  const open = blocks.filter((block) => block.status === "open");

  const readSelection = useCallback(() => {
    const sel = window.getSelection();
    const pre = preRef.current;
    if (!sel || !pre || sel.isCollapsed || sel.rangeCount === 0) {
      setSelection(null);
      return;
    }
    const range = sel.getRangeAt(0);
    if (!pre.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return;
    }
    const text = sel.toString();
    if (text.trim() === "") {
      setSelection(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    setSelection({ text, top: Math.max(8, rect.top - 40), left: Math.max(8, rect.left) });
  }, []);

  // Dismiss the floating bar when the selection goes away by any route —
  // a click elsewhere, Escape, the page scrolling it off.
  useEffect(() => {
    if (!selection) return;
    const onDown = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest(".rf-selection-bar")) setSelection(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelection(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [selection]);

  return (
    <aside className="rf-source" aria-label="Source text">
      <h2>Unplaced blocks ({open.length})</h2>
      {blocks.length === 0 && <p className="rf-hint">Every section was placed.</p>}
      {blocks.map((block) => (
        <BlockCard key={block.id} block={block} />
      ))}

      <details className="rf-fulltext" open={blocks.length === 0}>
        <summary>Full text{sourceMissing ? " — not saved (storage was full); upload the file again to see it" : ""}</summary>
        {!sourceMissing && (
          <pre ref={preRef} onMouseUp={readSelection} onKeyUp={readSelection} tabIndex={0}>
            {sourceText}
          </pre>
        )}
      </details>

      {selection && (
        <div className="rf-selection-bar" style={{ top: selection.top, left: selection.left }} role="toolbar" aria-label="Selected text">
          <AddToMenu text={selection.text} onDone={() => setSelection(null)} />
          <button
            type="button"
            className="rf-btn rf-btn-small"
            onClick={async () => {
              const ok = await copyText(selection.text, null);
              announce(ok ? "Copied." : "Could not copy.");
              setSelection(null);
            }}
          >
            Copy
          </button>
        </div>
      )}
    </aside>
  );
}
