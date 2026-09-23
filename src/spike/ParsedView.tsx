/**
 * Shows resume.json with each field's confidence beside it.
 *
 * Not the review form — that is stage 3 and it will be generated from the
 * schema. This is a read-only dump whose only job is to make the parser's
 * output and its uncertainty visible at the same time, so that "the parser
 * got this wrong" and "the parser knew it might be wrong" can be told apart.
 */
import { CONFIDENCE_REVIEW_THRESHOLD, type ParseResult } from "../schema/resume";

interface Props {
  result: ParseResult;
}

function Confidence({ value }: { value: number | undefined }) {
  if (value === undefined) return null;
  const flagged = value < CONFIDENCE_REVIEW_THRESHOLD;
  return (
    <span className={flagged ? "conf conf-low" : "conf"} title="parser confidence">
      {value.toFixed(2)}
    </span>
  );
}

function Field({
  label,
  value,
  path,
  confidence,
}: {
  label: string;
  value: string | undefined;
  path: string;
  confidence: Record<string, number>;
}) {
  if (value === undefined || value === "") return null;
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <span className="field-value">{value}</span>
      <Confidence value={confidence[path]} />
    </div>
  );
}

export function ParsedView({ result }: Props) {
  const { data, confidence } = result;
  const flagged = Object.entries(confidence).filter(
    ([, value]) => value < CONFIDENCE_REVIEW_THRESHOLD,
  );

  return (
    <div className="parsed">
      <p className="parsed-summary">
        {Object.keys(confidence).length} fields parsed · {flagged.length} flagged for review
      </p>

      <h3>Basics</h3>
      <Field label="Name" value={data.basics.name} path="basics.name" confidence={confidence} />
      <Field label="Title" value={data.basics.title} path="basics.title" confidence={confidence} />
      <Field label="Email" value={data.basics.email} path="basics.email" confidence={confidence} />
      <Field label="Phone" value={data.basics.phone} path="basics.phone" confidence={confidence} />
      <Field label="Location" value={data.basics.location} path="basics.location" confidence={confidence} />
      {data.basics.links.length > 0 && (
        <div className="field">
          <span className="field-label">Links</span>
          <span className="field-value">
            {data.basics.links.map((link) => `${link.label ?? ""}: ${link.url}`).join(" · ")}
          </span>
          <Confidence value={confidence["basics.links"]} />
        </div>
      )}
      <Field label="Summary" value={data.basics.summary} path="basics.summary" confidence={confidence} />

      {data.experience.length > 0 && <h3>Experience ({data.experience.length})</h3>}
      {data.experience.map((entry, index) => (
        <div className="entry" key={index}>
          <Field label="Role" value={entry.role} path={`experience.${index}.role`} confidence={confidence} />
          <Field label="Company" value={entry.company} path={`experience.${index}.company`} confidence={confidence} />
          <Field label="Location" value={entry.location} path={`experience.${index}.location`} confidence={confidence} />
          <Field
            label="Dates"
            value={entry.startDate ? `${entry.startDate} → ${entry.current ? "Present" : entry.endDate ?? "?"}` : undefined}
            path={`experience.${index}.startDate`}
            confidence={confidence}
          />
          {entry.bullets.length > 0 && (
            <ul>
              {entry.bullets.map((bullet, b) => (
                <li key={b}>{bullet}</li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {data.education.length > 0 && <h3>Education ({data.education.length})</h3>}
      {data.education.map((entry, index) => (
        <div className="entry" key={index}>
          <Field label="Degree" value={entry.degree} path={`education.${index}.degree`} confidence={confidence} />
          <Field label="Field" value={entry.field} path={`education.${index}.field`} confidence={confidence} />
          <Field label="School" value={entry.school} path={`education.${index}.school`} confidence={confidence} />
          <Field
            label="Dates"
            value={entry.startDate || entry.endDate ? `${entry.startDate ?? "?"} → ${entry.endDate ?? "?"}` : undefined}
            path={`education.${index}.endDate`}
            confidence={confidence}
          />
          <Field label="GPA" value={entry.gpa} path={`education.${index}.gpa`} confidence={confidence} />
        </div>
      ))}

      {data.skills.length > 0 && <h3>Skills ({data.skills.length} groups)</h3>}
      {data.skills.map((group, index) => (
        <Field
          key={index}
          label={group.category ?? "(uncategorised)"}
          value={group.items.join(", ")}
          path={`skills.${index}.items`}
          confidence={confidence}
        />
      ))}

      {data.projects.length > 0 && <h3>Projects ({data.projects.length})</h3>}
      {data.projects.map((entry, index) => (
        <div className="entry" key={index}>
          <Field label="Name" value={entry.name} path={`projects.${index}.name`} confidence={confidence} />
          <Field label="Tech" value={entry.tech.join(", ") || undefined} path={`projects.${index}.tech`} confidence={confidence} />
          <Field label="URL" value={entry.url} path={`projects.${index}.url`} confidence={confidence} />
          <Field label="Description" value={entry.description} path={`projects.${index}.description`} confidence={confidence} />
        </div>
      ))}

      {data.certifications.length > 0 && <h3>Certifications ({data.certifications.length})</h3>}
      {data.certifications.map((entry, index) => (
        <div className="entry" key={index}>
          <Field label="Name" value={entry.name} path={`certifications.${index}.name`} confidence={confidence} />
          <Field label="Issuer" value={entry.issuer} path={`certifications.${index}.issuer`} confidence={confidence} />
          <Field label="Date" value={entry.date} path={`certifications.${index}.date`} confidence={confidence} />
        </div>
      ))}

      <details>
        <summary>Raw resume.json</summary>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </details>
    </div>
  );
}
