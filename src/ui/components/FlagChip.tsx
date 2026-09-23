/**
 * The state of one field's review record, as a chip beside its label.
 *
 * Four states, three of them actionable:
 *   flagged   amber   "Check · 40%"  → Looks right (MARK_REVIEWED)
 *   missing   dashed  "Missing"      → Skip        (MARK_REVIEWED)
 *   reviewed  green   check          → click to re-flag (REFLAG)
 *   edited    muted   "edited"       → nothing; a typed value is the answer
 *
 * The confidence number stays in the tooltip after resolution so the user
 * can still see what the parser thought.
 */
import type { ReviewRecord } from "../review/state";

interface Props {
  record: ReviewRecord | undefined;
  flagged: boolean;
  missing: boolean;
  onReview: () => void;
  onReflag: () => void;
}

export function FlagChip({ record, flagged, missing, onReview, onReflag }: Props) {
  if (!record) return null;
  const pct = `${Math.round(record.confidence * 100)}%`;

  if (flagged && missing) {
    return (
      <button
        type="button"
        className="rf-chip rf-chip-missing"
        onClick={onReview}
        title="The parser found nothing for this field. Skip if the resume has none."
      >
        Missing · Skip
      </button>
    );
  }

  if (flagged) {
    return (
      <button
        type="button"
        className="rf-chip rf-chip-flag"
        onClick={onReview}
        title={`Parser was ${pct} sure. Click if it looks right.`}
      >
        Check · {pct} · Looks right
      </button>
    );
  }

  if (record.resolved === "reviewed") {
    return (
      <button
        type="button"
        className="rf-chip rf-chip-reviewed"
        onClick={onReflag}
        title={`Marked as looks right (parser was ${pct} sure). Click to flag again.`}
        aria-label="Reviewed. Click to flag again."
      >
        ✓
      </button>
    );
  }

  if (record.resolved === "edited") {
    return (
      <span className="rf-chip rf-chip-edited" title={`Edited (parser was ${pct} sure).`}>
        edited
      </span>
    );
  }

  return null;
}
