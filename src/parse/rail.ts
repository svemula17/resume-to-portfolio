/**
 * Rejoin a date range that a timeline layout split across two rows.
 *
 * A rail template sets each entry as a row: a narrow date column beside
 * the content. The date is too long for the column, so the template wraps
 * it — "Jan 2022 –" on the first row, "Present" on the second — and line
 * grouping, correctly, keeps each row as one line:
 *
 *     Jan 2022 –   Frontend Engineer
 *     Present   Lumen Labs · Remote
 *
 * Neither line holds a date range, so the entry splitter cannot see the
 * job. Here the two halves are put back together on the first line and
 * removed from the second, leaving exactly what a single-row template
 * would have produced. The three-space cell gap is what makes the date
 * cell recognisable as a cell.
 */
import type { Line } from "../layout";

const MONTH = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?";
const POINT = `(?:${MONTH}\\s+(?:19|20)\\d{2}|\\d{1,2}/(?:19|20)\\d{2}|(?:19|20)\\d{2})`;

/** "Jan 2022 –   Frontend Engineer": a date cell that ends in a dash. */
const OPEN_RANGE = new RegExp(`^(${POINT})\\s*([-\u2013\u2014\u2212])\\s{3,}(.*)$`);

/** "Present   Lumen Labs · Remote": the range's end, then the content. */
const CLOSE_RANGE = new RegExp(`^(${POINT}|Present|Current|Now|Ongoing|Today)\\s{3,}(.*)$`, "i");

export function mergeRailDates(lines: Line[]): Line[] {
  const out: Line[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const next = lines[i + 1];
    const open = OPEN_RANGE.exec(line.text);
    const close = next ? CLOSE_RANGE.exec(next.text) : null;
    if (open && close) {
      // The row's left edge is the date cell's; the content cell's edge is
      // what every later stage should see, or the indent pass reads the
      // row as a bullet indented under the page margin.
      const contentX = (items: Line["items"], fallback: number) => items[1]?.x ?? fallback;
      out.push({ ...line, x: contentX(line.items, line.x), text: `${open[1]} ${open[2]} ${close[1]}   ${open[3]}` });
      out.push({ ...next!, x: contentX(next!.items, next!.x), text: close[2]! });
      i += 1;
      continue;
    }
    out.push(line);
  }
  return out;
}
