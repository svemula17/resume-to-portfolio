/**
 * The skills vocabulary: is this string a thing people are skilled in?
 *
 * Built from O*NET, GitHub Linguist and devicon by scripts/build-skills.mjs
 * into skills.json (see README "Licence notes" and NOTICE). The lookup is
 * deliberately a yes/no over normalised strings and nothing more: no fuzzy
 * matching, no canonical casing, no "did you mean". The review form uses it
 * to flag what the parser split out of a prose line, not to rewrite what the
 * user wrote — "Node" stays "Node".
 */

export interface Vocabulary {
  has(term: string): boolean;
  isHot(term: string): boolean;
  readonly size: number;
}

// ---------------------------------------------------------------------------
// Normalisation — mirrored in scripts/build-skills.mjs. Change both or neither.
// The script cannot import this module (no build step on the Node side) and
// the app must not import the script, so the rules live twice. The test suite
// checks that the committed data is a fixed point of this version.
// ---------------------------------------------------------------------------

/**
 * O*NET names products the way a catalogue does: "Ansible software",
 * "Microsoft Project (software)", "Bitcoin mining program". Nobody writes
 * the suffix on a resume, so it goes.
 */
const ONET_SUFFIX = /\s+(?:\(software\)|software|program)$/;

/**
 * Trailing punctuation is list debris ("Python," or "Go."), but "+" and "#"
 * are spelling: "c++" and "c#" must survive, and a closing bracket is more
 * often balanced ("(software)", "[deprecated]") than stray. So the class is
 * explicit.
 */
const TRAILING_PUNCTUATION = /[.,;:!?'"`]+$/;

/**
 * Rules, in order: trim; collapse whitespace runs to one space; lowercase;
 * then strip trailing punctuation and an O*NET suffix, repeating until stable.
 * The result is what the set stores and what `has` looks up.
 */
export function normaliseTerm(term: string): string {
  let value = term.trim().replace(/\s+/g, " ").toLowerCase();
  // Punctuation first, so "Sitecore software." still loses its suffix, and
  // then until nothing changes, so the result is a fixed point: normalising
  // a normalised term is a no-op, which is what lets the test suite check
  // the committed data against the runtime copy of these rules.
  let previous;
  do {
    previous = value;
    value = value.replace(TRAILING_PUNCTUATION, "").replace(ONET_SUFFIX, "").trim();
  } while (value !== previous);
  return value;
}

/**
 * The one spelling variant `has` forgives. Resumes write JavaScript things
 * three ways — "Node.js", "NodeJS", "Node JS" — and the sources disagree
 * with each other about which is canonical (devicon says "nodejs", O*NET
 * says "Node.js"). Rather than guess, a term ending in "js" matches when
 * any of the base, base+".js", base+"js" or base+" js" is present.
 *
 * It is one-directional on purpose: "vue" does not match "vue.js", because
 * a bare word matching a longer term is exactly the guessing this module
 * refuses to do.
 */
function jsVariants(term: string): string[] {
  if (!term.endsWith("js")) return [];
  const base = term.slice(0, -2).replace(/[.\s]+$/, "");
  if (base === "") return [];
  return [base, `${base}.js`, `${base}js`, `${base} js`];
}

export function vocabularyFrom(skills: string[], hot: string[] = []): Vocabulary {
  // Normalised on the way in so a caller handing over raw strings gets the
  // same answers as one handing over skills.json, which is already normal.
  const all = new Set(skills.map(normaliseTerm));
  const hotSet = new Set(hot.map(normaliseTerm));
  all.delete("");
  hotSet.delete("");

  const lookup = (set: Set<string>, term: string): boolean => {
    const value = normaliseTerm(term);
    if (value === "") return false;
    if (set.has(value)) return true;
    return jsVariants(value).some((variant) => set.has(variant));
  };

  return {
    has: (term) => lookup(all, term),
    isHot: (term) => lookup(hotSet, term),
    size: all.size,
  };
}

let loading: Promise<Vocabulary> | undefined;

/**
 * Dynamic import so Vite splits the ~190 KB of JSON into its own chunk. The
 * landing page and the parser never touch it; only the review form does,
 * and only after a resume has been parsed. Memoised so repeat callers share
 * one fetch and one Set.
 */
export async function loadVocabulary(): Promise<Vocabulary> {
  loading ??= (async () => {
    const data = await import("./skills.json");
    return vocabularyFrom(data.default.skills, data.default.hot);
  })();
  return loading;
}
