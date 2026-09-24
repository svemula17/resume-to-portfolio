/**
 * Choose a template. A radio group, because that is what it is: one of
 * three, exactly one at a time, arrow keys to move. Each option is a card
 * with the template's name, one sentence and its traits; the live preview
 * beside it is the real picture, so no thumbnail is faked here.
 */
import type { TemplateId, TemplateMeta } from "../../templates/types";

interface Props {
  templates: TemplateMeta[];
  selected: TemplateId;
  onSelect: (id: TemplateId) => void;
}

export function TemplatePicker({ templates, selected, onSelect }: Props) {
  const onKey = (event: React.KeyboardEvent<HTMLDivElement>, index: number) => {
    const delta = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = templates[(index + delta + templates.length) % templates.length];
    if (next) {
      onSelect(next.id);
      (event.currentTarget.parentElement?.children[templates.indexOf(next)] as HTMLElement | undefined)?.focus();
    }
  };

  return (
    <div className="rf-picker" role="radiogroup" aria-label="Template">
      {templates.map((template, index) => {
        const checked = template.id === selected;
        return (
          <div
            key={template.id}
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className={`rf-picker-option${checked ? " rf-picker-selected" : ""}`}
            onClick={() => onSelect(template.id)}
            onKeyDown={(event) => {
              if (event.key === " " || event.key === "Enter") {
                event.preventDefault();
                onSelect(template.id);
              } else {
                onKey(event, index);
              }
            }}
          >
            <div className="rf-picker-name">{template.name}</div>
            <p className="rf-picker-desc">{template.description}</p>
            <ul className="rf-picker-traits">
              {template.traits.map((trait) => (
                <li key={trait}>{trait}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
