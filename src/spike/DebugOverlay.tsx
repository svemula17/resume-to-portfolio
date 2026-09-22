/**
 * Draws the layout decision on top of the rendered page.
 *
 * This view is the deliverable of the reading-order stage. When a resume comes
 * out scrambled, the question is always "why was it split there", and the only
 * useful answer is a picture: the gutter band, the boxes the detector assigned
 * to each column, and the order it read them in. Everything here earns its
 * place by answering that question.
 */
import type { PageReadingOrder } from "../layout";
import type { RenderedPage } from "../extract/render";

interface Props {
  rendered: RenderedPage;
  order: PageReadingOrder;
  showLineBoxes: boolean;
  showReadingOrder: boolean;
}

/** Colours are assigned by role, so a glance tells you which column is which. */
const ROLE_COLOUR = {
  full: "#b45309",
  left: "#1d4ed8",
  right: "#047857",
  single: "#4b5563",
} as const;

export function DebugOverlay({ rendered, order, showLineBoxes, showReadingOrder }: Props) {
  // Every box is computed in PDF points and scaled once, here. Mixing the two
  // coordinate spaces anywhere else is how overlays end up subtly misaligned
  // and stop being trustworthy.
  const scale = rendered.width / rendered.pointWidth;

  const itemRole = (x: number, right: number): keyof typeof ROLE_COLOUR => {
    if (order.layout.type === "single") return "single";
    if (right <= order.layout.gutterStart) return "left";
    if (x >= order.layout.gutterEnd) return "right";
    return "full";
  };

  return (
    <div className="overlay" style={{ width: rendered.width, height: rendered.height }}>
      <img src={rendered.dataUrl} width={rendered.width} height={rendered.height} alt="" />

      {order.layout.type === "two-column" && (
        <div
          className="overlay-gutter"
          title={`Gutter: ${order.layout.gutterStart.toFixed(0)}-${order.layout.gutterEnd.toFixed(0)}pt`}
          style={{
            left: order.layout.gutterStart * scale,
            width: (order.layout.gutterEnd - order.layout.gutterStart) * scale,
          }}
        />
      )}

      {showLineBoxes &&
        order.lines.map((line, index) => {
          const role = itemRole(line.x, line.right);
          return (
            <div
              key={`${line.y}-${index}`}
              className="overlay-line"
              style={{
                // y is a baseline, so the box top is one line height above it.
                top: (line.y - line.height) * scale,
                left: line.x * scale,
                width: Math.max((line.right - line.x) * scale, 2),
                height: line.height * scale,
                borderColor: ROLE_COLOUR[role],
              }}
            >
              {showReadingOrder && (
                <span className="overlay-index" style={{ background: ROLE_COLOUR[role] }}>
                  {index + 1}
                </span>
              )}
            </div>
          );
        })}
    </div>
  );
}
