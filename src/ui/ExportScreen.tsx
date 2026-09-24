/**
 * The stage-4 screen: pick a template, see the site, download it.
 *
 * Everything shown here is rendered from normalise(resume) — the same
 * value the ZIP contains — so the preview and the download cannot
 * disagree. The working state, with its trailing empty bullet and its
 * un-trimmed title, never reaches a template.
 */
import { useMemo, useState, type Dispatch } from "react";
import { inlineForPreview, renderSite, templateMetas, templateOf } from "../templates/render";
import { isTemplateId, type TemplateId } from "../templates/types";
import { SitePreview, type PreviewWidth } from "./components/SitePreview";
import { TemplatePicker } from "./components/TemplatePicker";
import { downloadBlob, downloadText } from "./download";
import { zipBlob, zipFileName } from "./export/zip";
import type { HistoryAction } from "./review/history";
import { normalise, toResumeJson } from "./review/export";
import type { ReviewState } from "./review/state";

interface Props {
  state: ReviewState;
  dispatch: Dispatch<HistoryAction>;
  onBack: () => void;
}

export function ExportScreen({ state, dispatch, onBack }: Props) {
  const templates = useMemo(() => templateMetas(), []);
  const selected: TemplateId = isTemplateId(state.templateId) ? state.templateId : "minimal";
  const [width, setWidth] = useState<PreviewWidth>("desktop");
  const [downloaded, setDownloaded] = useState<string | null>(null);

  // normalise() throws only on an empty name, and the review screen does
  // not let the user leave with one. Guarded anyway: a screen that throws
  // is worse than one that shows a message.
  const resume = useMemo(() => {
    try {
      return normalise(state.resume);
    } catch {
      return null;
    }
  }, [state.resume]);

  // The visitor's language is unknown; the author's is the best available
  // guess for <html lang>, and "en" is the fallback the templates use.
  const lang = useMemo(() => (navigator.language || "en").split("-")[0] || "en", []);
  const site = useMemo(() => (resume ? renderSite(resume, selected, { lang }) : null), [resume, selected, lang]);
  const preview = useMemo(() => (site ? inlineForPreview(site) : ""), [site]);

  const downloadZip = () => {
    if (!site || !resume) return;
    const name = zipFileName(resume.basics.name);
    downloadBlob(zipBlob(site), name);
    setDownloaded(name);
  };

  if (!resume || !site) {
    return (
      <div className="rf">
        <div className="rf-banner rf-banner-issue" style={{ margin: "1.5rem" }}>
          <span>The resume needs a name before a site can be built.</span>
          <button type="button" className="rf-btn rf-btn-small" onClick={onBack}>
            Back to review
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rf">
      <header className="rf-header">
        <button type="button" className="rf-btn rf-btn-small" onClick={onBack}>
          ‹ Back to review
        </button>
        <h1>
          Choose a template <span className="rf-file">· {resume.basics.name}</span>
        </h1>
        <div className="rf-walk" role="group" aria-label="Preview width">
          <button
            type="button"
            className={`rf-btn rf-btn-small${width === "desktop" ? " rf-btn-primary" : ""}`}
            aria-pressed={width === "desktop"}
            onClick={() => setWidth("desktop")}
          >
            Desktop
          </button>
          <button
            type="button"
            className={`rf-btn rf-btn-small${width === "mobile" ? " rf-btn-primary" : ""}`}
            aria-pressed={width === "mobile"}
            onClick={() => setWidth("mobile")}
          >
            Phone
          </button>
        </div>
        <span className="rf-status">{downloaded ? `Downloaded ${downloaded}` : ""}</span>
        <div className="rf-walk">
          <button type="button" className="rf-btn rf-btn-small" onClick={() => downloadText(toResumeJson(state), "resume.json")}>
            resume.json
          </button>
          <button type="button" className="rf-btn rf-btn-primary rf-btn-small" onClick={downloadZip}>
            Download site (ZIP)
          </button>
        </div>
      </header>

      <div className="rf-export">
        <aside className="rf-export-side">
          <TemplatePicker
            templates={templates}
            selected={selected}
            onSelect={(id) => dispatch({ type: "SET_TEMPLATE", templateId: id })}
          />
          <div className="rf-export-note">
            <p>
              The ZIP holds <code>index.html</code>, <code>styles.css</code> and a <code>README.md</code> with
              deploy steps. No JavaScript, no external requests. Open <code>index.html</code> offline and it works.
            </p>
            <p className="rf-hint">Template: {templateOf(selected).meta.name}</p>
          </div>
        </aside>
        <main className="rf-export-main">
          <SitePreview markup={preview} width={width} title={`${resume.basics.name} — ${templateOf(selected).meta.name}`} />
        </main>
      </div>
    </div>
  );
}
