/**
 * The contact block, through the same FieldInput as everything else. The
 * one `list` widget — links — renders the generic SectionList in compact
 * mode, so links get id-keyed move and remove with no bespoke component.
 */
import { isFlagged } from "../review/adopt";
import { BASICS_FIELDS, type FieldDescriptor } from "../review/descriptors";
import { fieldKey } from "../review/keys";
import { readBasicsField } from "../review/lists";
import { isSeededMissing } from "../review/selectors";
import { FieldInput } from "./FieldInput";
import { SectionList } from "./SectionList";
import { useReview } from "./review-context";

export function BasicsPanel() {
  const { state, dispatch, issuesByKey, touched, markTouched, showAllIssues } = useReview();
  const fields = BASICS_FIELDS as Record<string, FieldDescriptor>;

  return (
    <section className="rf-basics" aria-label="Basics">
      <div className="rf-grid">
        {Object.entries(fields).map(([name, descriptor]) => {
          if (descriptor.widget === "list") {
            return (
              <div className="rf-field rf-field-wide" key={name}>
                <SectionList path="basics.links" compact />
              </div>
            );
          }
          const key = fieldKey("basics", name);
          const record = state.review[key];
          const flagged = isFlagged(record);
          return (
            <FieldInput
              key={name}
              fieldKey={key}
              descriptor={descriptor}
              value={readBasicsField(state.resume, name)}
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
    </section>
  );
}
