import { describe, expect, it } from "vitest";
import { confidenceOf, feature, pickBest, scoreAll } from "./features";

const NAME_FEATURES = [
  feature<string>("letters only", 3, (t) => /^[a-zA-Z\s.]+$/.test(t)),
  feature<string>("all uppercase", 2, (t) => t === t.toUpperCase()),
  feature<string>("has @", -4, (t) => t.includes("@")),
  feature<string>("has digit", -4, (t) => /\d/.test(t)),
  feature<string>("has comma", -4, (t) => t.includes(",")),
  feature<string>("has slash", -4, (t) => t.includes("/")),
];

describe("scoreAll", () => {
  it("ranks the name above the contact line and the address", () => {
    const ranked = scoreAll(
      ["SAI KUMAR VEMULA", "sai@example.com", "917-516-6967", "Jersey City, NJ"],
      NAME_FEATURES,
    );

    expect(ranked[0]!.candidate).toBe("SAI KUMAR VEMULA");
    expect(ranked[0]!.matched).toEqual(["letters only", "all uppercase"]);
    expect(ranked[0]!.score).toBe(5);
  });

  it("lets negative features push a plausible-looking candidate down", () => {
    const ranked = scoreAll(["ACME, INC.", "Jane Doe"], NAME_FEATURES);
    expect(ranked[0]!.candidate).toBe("Jane Doe");
  });
});

describe("confidenceOf", () => {
  it("is high for an unopposed strong winner", () => {
    const ranked = scoreAll(["SAI KUMAR VEMULA", "sai@example.com"], NAME_FEATURES);
    expect(confidenceOf(ranked, NAME_FEATURES)).toBeGreaterThan(0.75);
  });

  it("is lower for a narrow win between near-identical rivals", () => {
    // Two plausible names. Whichever wins, the user should be asked.
    const ranked = scoreAll(["Jane Doe", "John Roe"], NAME_FEATURES);
    const close = confidenceOf(ranked, NAME_FEATURES);
    const clear = confidenceOf(
      scoreAll(["Jane Doe", "917-516-6967"], NAME_FEATURES),
      NAME_FEATURES,
    );
    expect(close).toBeLessThan(clear);
  });

  it("is 0 when nothing scores above zero", () => {
    expect(confidenceOf(scoreAll(["a@b.com, 1/2"], NAME_FEATURES), NAME_FEATURES)).toBe(0);
  });
});

describe("pickBest", () => {
  it("returns null rather than a negative-scoring guess", () => {
    expect(pickBest(["sai@example.com, 1/2"], NAME_FEATURES)).toBeNull();
  });

  it("carries the runners-up for debugging", () => {
    const winner = pickBest(["SAI KUMAR VEMULA", "sai@example.com"], NAME_FEATURES);
    expect(winner!.value).toBe("SAI KUMAR VEMULA");
    expect(winner!.alternatives).toHaveLength(1);
  });
});
