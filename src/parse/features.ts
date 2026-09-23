/**
 * The feature-scoring registry.
 *
 * Each field declares a set of feature functions, each carrying a positive or
 * negative score. Every candidate line in the relevant section is scored
 * against the full set; the highest scorer wins, and how convincingly it won
 * becomes the confidence shown in the review form.
 *
 * The value of this shape over a pile of if-statements is not accuracy, it is
 * debuggability: when a field comes out wrong you can print the score table
 * and see exactly which feature fired and which did not.
 */
import { clamp01 } from "./text";

export interface Feature<C> {
  name: string;
  score: number;
  test: (candidate: C) => boolean;
}

export interface Scored<C> {
  candidate: C;
  score: number;
  /** Which features fired. Kept for debugging, not used in the decision. */
  matched: string[];
}

export interface Winner<C> {
  value: C;
  score: number;
  confidence: number;
  matched: string[];
  /** Runners-up, best first. */
  alternatives: Scored<C>[];
}

export function scoreAll<C>(candidates: C[], features: Feature<C>[]): Scored<C>[] {
  return candidates
    .map((candidate) => {
      let score = 0;
      const matched: string[] = [];
      for (const feature of features) {
        if (feature.test(candidate)) {
          score += feature.score;
          matched.push(feature.name);
        }
      }
      return { candidate, score, matched };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Confidence blends two different questions, because either alone is
 * misleading.
 *
 * How strong is the winner in absolute terms? A candidate that fired one weak
 * feature and beat nothing else is not trustworthy just because it came
 * first — that is the case where a parser confidently reports the wrong line
 * and the user does not think to check it.
 *
 * How clearly did it win? A candidate that edged out three near-identical
 * rivals is a coin toss, however high its raw score.
 *
 * Weighted toward the absolute score, because a wrong-but-unopposed answer is
 * both more common and more damaging than a close call. The review form flags
 * anything below CONFIDENCE_REVIEW_THRESHOLD, so the cost of being pessimistic
 * is one extra field to glance at, and the cost of being optimistic is a
 * mistake that ships.
 */
export function confidenceOf<C>(ranked: Scored<C>[], features: Feature<C>[]): number {
  const best = ranked[0];
  if (!best || best.score <= 0) return 0;

  const positiveTotal = features
    .filter((feature) => feature.score > 0)
    .reduce((sum, feature) => sum + feature.score, 0);
  if (positiveTotal <= 0) return 0;

  const strength = clamp01(best.score / positiveTotal);

  const runnerUp = ranked[1];
  const separation =
    runnerUp === undefined
      ? 1
      : clamp01((best.score - runnerUp.score) / Math.max(1, positiveTotal / 2));

  return clamp01(0.65 * strength + 0.35 * separation);
}

/** Score the candidates and return the winner, or null if none scored above 0. */
export function pickBest<C>(candidates: C[], features: Feature<C>[]): Winner<C> | null {
  const ranked = scoreAll(candidates, features);
  const best = ranked[0];
  if (!best || best.score <= 0) return null;

  return {
    value: best.candidate,
    score: best.score,
    confidence: confidenceOf(ranked, features),
    matched: best.matched,
    alternatives: ranked.slice(1),
  };
}

/** Convenience for building a feature without repeating the object shape. */
export function feature<C>(
  name: string,
  score: number,
  test: (candidate: C) => boolean,
): Feature<C> {
  return { name, score, test };
}
