/**
 * One descriptor → one control.
 *
 * Every widget is a plain controlled input dispatching on every change.
 * There is no local draft state anywhere, so nothing has to be flushed
 * before a shortcut moves focus, and typing resolves a flag on the first
 * keystroke — the visual reward that makes the walk feel fast.
 *
 * List widgets use an exact-inverse split and join so React never rewrites
 * what the user just typed. `lines` is items.join("\n") ↔ value.split("\n"),
 * exact for every string. `tags` is items.join(", ") ↔ value.split(/,\s?/),
 * exact except a comma typed with no following space, which gains one.
 * Trimming happens only in normalise(), at export.
 */
import { useId } from "react";
import type { FieldDescriptor } from "../review/descriptors";
import type { FieldKey } from "../review/keys";
import type { FieldValue, ReviewRecord } from "../review/state";
import { FlagChip } from "./FlagChip";

interface Props {
  fieldKey: FieldKey;
  descriptor: FieldDescriptor;
  value: FieldValue;
  /** Value of the sibling named by descriptor.disabledWhen, if any. */
  disabledBy?: FieldValue;
  record: ReviewRecord | undefined;
  flagged: boolean;
  missing: boolean;
  issue: string | undefined;
  /** Issues show only after the field has been touched or a download attempted. */
  showIssue: boolean;
  onChange: (value: FieldValue) => void;
  onReview: () => void;
  onReflag: () => void;
  onBlur: () => void;
}

function toText(value: FieldValue, widget: FieldDescriptor["widget"]): string {
  if (Array.isArray(value)) return widget === "tags" ? value.join(", ") : value.join("\n");
  if (typeof value === "string") return value;
  return "";
}

function fromText(text: string, widget: FieldDescriptor["widget"]): FieldValue {
  if (widget === "lines") return text.split("\n");
  if (widget === "tags") return text.split(/,\s?/);
  return text;
}

export function FieldInput({
  fieldKey,
  descriptor,
  value,
  disabledBy,
  record,
  flagged,
  missing,
  issue,
  showIssue,
  onChange,
  onReview,
  onReflag,
  onBlur,
}: Props) {
  const id = useId();
  const issueId = `${id}-issue`;
  const { widget, label } = descriptor;
  const disabled = descriptor.disabledWhen !== undefined && disabledBy === true;
  const visibleIssue = showIssue && issue ? issue : undefined;

  const stateClass = [
    "rf-field",
    widget === "text" || widget === "checkbox" ? "" : "rf-field-wide",
    widget === "checkbox" ? "rf-field-check" : "",
    flagged && !missing ? "rf-field-flagged" : "",
    flagged && missing ? "rf-field-missing" : "",
    visibleIssue ? "rf-field-issue" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const chip = (
    <FlagChip record={record} flagged={flagged} missing={missing} onReview={onReview} onReflag={onReflag} />
  );

  if (widget === "checkbox") {
    return (
      <div className={stateClass}>
        <input
          id={id}
          type="checkbox"
          data-fkey={fieldKey}
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
          onBlur={onBlur}
        />
        <label htmlFor={id} className="rf-field-label">
          {label}
        </label>
        {chip}
      </div>
    );
  }

  const text = toText(value, widget);
  const describedBy = visibleIssue ? issueId : undefined;
  const placeholder = disabled ? "Present" : descriptor.placeholder;

  return (
    <div className={stateClass}>
      <label htmlFor={id} className="rf-field-label">
        {label}
        {chip}
      </label>
      {widget === "textarea" || widget === "lines" ? (
        <textarea
          id={id}
          className="rf-textarea"
          data-fkey={fieldKey}
          value={text}
          rows={Math.min(12, Math.max(3, text.split("\n").length + 1))}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={visibleIssue ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(fromText(event.target.value, widget))}
          onBlur={onBlur}
        />
      ) : (
        <input
          id={id}
          type="text"
          className="rf-input"
          data-fkey={fieldKey}
          value={text}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={visibleIssue ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(fromText(event.target.value, widget))}
          onBlur={onBlur}
        />
      )}
      {visibleIssue && (
        <span id={issueId} className="rf-field-issue-text">
          {visibleIssue}
        </span>
      )}
    </div>
  );
}
