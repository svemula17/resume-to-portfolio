import type { TextItem } from "../extract/types";

/** One visual line of text, in top-left coordinates. */
export interface Line {
  /** Left-to-right, already merged where pdf.js had split a run. */
  items: TextItem[];
  /** Shared baseline of the line. */
  y: number;
  /** Tallest item on the line. */
  height: number;
  /** True when every item on the line is bold — a section-header signal. */
  isBold: boolean;
  /** Left edge of the leftmost item. */
  x: number;
  /** Right edge of the rightmost item. */
  right: number;
  text: string;
}

export type ColumnLayout =
  | { type: "single"; items: TextItem[] }
  | {
      type: "two-column";
      /** Centre of the detected gutter, in PDF points from the left edge. */
      gutterX: number;
      /** Extent of the gutter, for the debug overlay. */
      gutterStart: number;
      gutterEnd: number;
      leftItems: TextItem[];
      rightItems: TextItem[];
      /** Items straddling the gutter: a header block, or a rule of text. */
      fullWidthItems: TextItem[];
    };
