/** Public surface of the layout layer. */
export { groupIntoLines, averageCharWidth } from "./lines";
export {
  detectColumns,
  buildCoverageHistogram,
  findEmptyRuns,
  findGutterCandidate,
} from "./columns";
export type { Gap } from "./columns";
export {
  orderPage,
  toPageReadingOrders,
  toReadingOrder,
  toPlainText,
} from "./reading-order";
export type { PageReadingOrder } from "./reading-order";
export type { Line, ColumnLayout } from "./types";
