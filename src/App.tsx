/**
 * Stage 1 spike UI. Deliberately throwaway.
 *
 * One job: upload a resume, see the reconstructed reading order, and see WHY
 * it came out that way. No review form, no templates, no export — those are
 * later stages and building them now would mean building them on top of a
 * reading-order implementation nobody has scored yet.
 */
import { useCallback, useRef, useState } from "react";
import {
  detectFormat,
  extractDocxText,
  extractTextItems,
  type Page,
} from "./extract";
import { renderPageImages, type RenderedPage } from "./extract/render";
import { toPageReadingOrders, type PageReadingOrder } from "./layout";
import { DebugOverlay } from "./spike/DebugOverlay";
import "./App.css";

interface Result {
  fileName: string;
  text: string;
  orders: PageReadingOrder[];
  rendered: RenderedPage[];
}

function describeLayout(order: PageReadingOrder): string {
  if (order.layout.type === "single") return "single column";
  const { gutterStart, gutterEnd, leftItems, rightItems, fullWidthItems } = order.layout;
  return (
    `two columns · gutter ${gutterStart.toFixed(0)}–${gutterEnd.toFixed(0)}pt · ` +
    `${leftItems.length} left / ${rightItems.length} right / ${fullWidthItems.length} full-width`
  );
}

export default function App() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [debug, setDebug] = useState(true);
  const [showLineBoxes, setShowLineBoxes] = useState(true);
  const [showReadingOrder, setShowReadingOrder] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const format = detectFormat(file);

      if (format === "docx") {
        // DOCX carries no geometry, so there is no layout decision to show and
        // nothing for the overlay to draw. Say so rather than showing an empty
        // debug panel that looks like a failure.
        const text = await extractDocxText(file);
        setResult({ fileName: file.name, text, orders: [], rendered: [] });
        return;
      }

      if (format !== "pdf") {
        throw new Error(`Unsupported file type: ${file.name}. Upload a PDF or DOCX.`);
      }

      const pages: Page[] = await extractTextItems(file);
      const orders = toPageReadingOrders(pages);
      const text = orders
        .flatMap((order) => order.lines.map((line) => line.text))
        .join("\n");

      // Rendering is only needed for the overlay, and it is the slow part, so
      // it is skipped entirely when the debug view is off.
      const rendered = debug ? await renderPageImages(file) : [];

      setResult({ fileName: file.name, text, orders, rendered });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }, [debug]);

  return (
    <div className="app">
      <header>
        <h1>Reading-order spike</h1>
        <p>
          Stage 1. Upload a resume and check that the reconstructed text reads in the
          order a human would read it. Nothing leaves your browser.
        </p>
      </header>

      <section className="controls">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <label>
          <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} />
          Debug overlay
        </label>
        <label>
          <input
            type="checkbox"
            checked={showLineBoxes}
            disabled={!debug}
            onChange={(e) => setShowLineBoxes(e.target.checked)}
          />
          Line boxes
        </label>
        <label>
          <input
            type="checkbox"
            checked={showReadingOrder}
            disabled={!debug || !showLineBoxes}
            onChange={(e) => setShowReadingOrder(e.target.checked)}
          />
          Reading order
        </label>
      </section>

      {busy && <p className="status">Parsing…</p>}
      {error && <p className="error">{error}</p>}

      {result && (
        <div className="panes">
          <section className="pane">
            <h2>Reconstructed text — {result.fileName}</h2>
            <pre>{result.text}</pre>
          </section>

          {debug && result.rendered.length > 0 && (
            <section className="pane">
              <h2>Layout decision</h2>
              <div className="legend">
                <span style={{ color: "#b45309" }}>■ full-width</span>
                <span style={{ color: "#1d4ed8" }}>■ left</span>
                <span style={{ color: "#047857" }}>■ right</span>
                <span style={{ color: "#4b5563" }}>■ single</span>
              </div>
              {result.rendered.map((rendered, index) => {
                const order = result.orders[index];
                if (!order) return null;
                return (
                  <figure key={rendered.pageNumber}>
                    <figcaption>
                      Page {rendered.pageNumber} — {describeLayout(order)}
                    </figcaption>
                    <DebugOverlay
                      rendered={rendered}
                      order={order}
                      showLineBoxes={showLineBoxes}
                      showReadingOrder={showReadingOrder}
                    />
                  </figure>
                );
              })}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
