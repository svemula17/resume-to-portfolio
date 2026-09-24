import { describe, expect, it } from "vitest";
import { linesFromText } from "./from-text";
import { mergeRailDates } from "./rail";
import { parseText } from "./index";

describe("mergeRailDates", () => {
  it("rejoins a range split across two rows and frees the content", () => {
    const lines = linesFromText("Jan 2022 –   Frontend Engineer\nPresent   Lumen Labs · Remote\nRebuilt the checkout flow.");
    expect(mergeRailDates(lines).map((l) => l.text)).toEqual([
      "Jan 2022 – Present   Frontend Engineer",
      "Lumen Labs · Remote",
      "Rebuilt the checkout flow.",
    ]);
  });

  it("leaves a line whose dash is not followed by a cell gap alone", () => {
    const lines = linesFromText("Jan 2022 – Present\nLumen Labs");
    expect(mergeRailDates(lines).map((l) => l.text)).toEqual(["Jan 2022 – Present", "Lumen Labs"]);
  });
});

describe("a timeline rail resume", () => {
  it("parses every job", () => {
    const result = parseText(`Priya Raman
Frontend Engineer
priya@example.com

EXPERIENCE
Jan 2022 –   Frontend Engineer
Present   Lumen Labs · Remote
Rebuilt the checkout flow in React.
Jun 2020 –   Junior Developer
Dec 2021   Bright Owl · Oakland, CA
Maintained the marketing site.`);

    expect(result.data.experience.map((j) => [j.role, j.company, j.startDate, j.endDate ?? "Present"])).toEqual([
      ["Frontend Engineer", "Lumen Labs", "Jan 2022", "Present"],
      ["Junior Developer", "Bright Owl", "Jun 2020", "Dec 2021"],
    ]);
  });
});
