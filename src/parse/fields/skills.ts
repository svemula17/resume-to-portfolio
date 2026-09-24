/**
 * Skills.
 *
 * Two layouts cover nearly everything: labelled groups
 * ("Languages: Python, Go") and a flat list. Both reduce to the same shape,
 * with `category` simply absent for the flat case.
 */
import type { Vocabulary } from "../../data/vocabulary";
import type { Line } from "../../layout";
import type { SkillGroup } from "../../schema/resume";
import { isBulletLine, stripBullet } from "../text";

/**
 * Words a category label is made of. A short line that is one of these
 * over a list — delimited or one per line — names the group beneath it.
 */
const CATEGORY_WORD =
  /^(?:core\s+)?(?:languages?|frameworks?|libraries|tools?|tooling|platforms?|cloud|data|databases?|devops|infrastructure|frontend|backend|full[\s-]?stack|mobile|testing|qa|security|observability|monitoring|analytics|ml|machine learning|ai|design|leadership|management|soft skills|methodologies|practices|technologies|technical|other|misc(?:ellaneous)?|certifications?|domains?)(?:\s*&\s*\w+)?$/i;

/**
 * A label is short and ends in a colon. Requiring the colon is what keeps
 * "Python, Go, TypeScript" from being read as a category named "Python".
 */
const LABELLED = /^([A-Za-z][A-Za-z0-9&/+#.()\s-]{1,40}?)\s*[::]\s*(.+)$/;

/** Separators that appear between skills, but not inside one. */
const SEPARATORS = /[,;|•·]|\s{3,}|\s+\/\s+/;

/**
 * Split a skill list into items.
 *
 * Kept deliberately dumb: no vocabulary lookup, no normalisation, no
 * canonical-casing. The skills dataset arrives in stage 5, and guessing at
 * canonical names before then would silently rewrite things the user wrote
 * deliberately ("Node" is not "Node.js" to everyone).
 */
export function splitSkillItems(text: string): string[] {
  return text
    // "AWS (IAM, Security Hub)" becomes AWS, IAM, Security Hub. Splitting on
    // the commas without this yields "AWS (IAM" and "Security Hub)", which
    // is what the first real resume produced. The parent is kept: it is a
    // skill in its own right, and the grouping is not information a flat
    // skills list can represent anyway.
    .replace(/\s*\(([^()]*)\)/g, (_, inner: string) => `, ${inner}, `)
    .split(SEPARATORS)
    .map((item) => item.trim().replace(/[.]+$/, ""))
    .filter((item) => item.length > 0 && item.length <= 60);
}

/**
 * The share of a flat list that must be known terms before the list is
 * trusted without a review stop. Prose that happened to split on commas —
 * "Detects and mitigates prompt injection, runs reviews" — scores near zero
 * against the vocabulary; a real list of tools scores near one. The bar is
 * set where a list of mostly niche or in-house names still passes if the
 * half the vocabulary knows about is there.
 */
const KNOWN_SHARE_TO_TRUST = 0.5;

function knownShare(items: string[], vocabulary: Vocabulary): number {
  if (items.length === 0) return 0;
  return items.filter((item) => vocabulary.has(item)).length / items.length;
}

export function parseSkills(
  lines: Line[],
  vocabulary?: Vocabulary,
): {
  value: SkillGroup[];
  confidence: Record<string, number>;
} {
  // Raw text is accumulated per group and split once at the end, rather than
  // line by line. A list that wraps mid-parenthesis — "AWS (IAM, KMS, Secrets"
  // on one line and "Manager), Terraform" on the next — can only be split
  // correctly once both halves are back together.
  const raw: Array<{ category?: string; text: string }> = [];
  let open: { category?: string; text: string } | null = null;

  const flat: string[] = [];
  let pendingLabel: string | null = null;
  const isListLine = (candidate: Line | undefined): boolean => {
    if (!candidate) return false;
    if (candidate.items.length >= 2 && candidate.items.every((item) => item.str.trim().length <= 30)) return true;
    return candidate.text.split(/[,;|•·]/).filter((part) => part.trim()).length >= 2;
  };
  const isShortLine = (candidate: string): boolean =>
    !/[,;:|•·]/.test(candidate) && candidate.split(/\s+/).length <= 3 && candidate.length <= 30;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    let text = isBulletLine(line.text) ? stripBullet(line.text) : line.text.trim();
    if (text === "") continue;
    const next = lines[index + 1];

    // A comma list that wrapped: the previous line ended mid-list, so this
    // line continues it whatever it looks like — "dbt" alone on a line is
    // the last item, not the next category.
    if (open && /,\s*$/.test(open.text)) {
      open.text = `${open.text} ${text}`;
      continue;
    }

    // Which short lines are category labels and which are skills.
    //
    // "Languages" over "Go, Python" is a label: the next line is a list.
    // "Languages" over "TypeScript" over "CSS" is a label over a one-per-
    // line list, and only a category word or the vocabulary can tell the
    // label from the first item. Without either signal a short line is a
    // skill, because a lost label costs a category and a lost skill costs
    // the skill.
    const shortLine = isShortLine(text) && line.items.length === 1;
    if (pendingLabel !== null && shortLine) {
      open = { category: pendingLabel, text };
      raw.push(open);
      pendingLabel = null;
      continue;
    }
    if (pendingLabel !== null) {
      text = `${pendingLabel}: ${text}`;
      pendingLabel = null;
    } else if (shortLine) {
      const nextText = next?.text.trim() ?? "";
      // A term the vocabulary knows is a skill, whatever follows it: "CSS"
      // wrapped onto its own line above the next group is not that group's
      // label.
      const known = vocabulary?.has(text) === true;
      const labelByShape = !known && isListLine(next);
      const labelByWord = !known && CATEGORY_WORD.test(text) && nextText !== "";
      const labelByVocabulary =
        vocabulary !== undefined && !vocabulary.has(text) && isShortLine(nextText) && vocabulary.has(nextText);
      if (labelByShape || labelByWord || labelByVocabulary) {
        pendingLabel = text;
        continue;
      }
      if (open && open.category) {
        // Another item of the one-per-line group above.
        open.text = `${open.text}, ${text}`;
        continue;
      }
      flat.push(...splitSkillItems(text));
      continue;
    }

    const labelled = LABELLED.exec(text);
    if (labelled) {
      open = { category: labelled[1]!.trim(), text: labelled[2]! };
      raw.push(open);
      continue;
    }

    // An unlabelled line directly after a labelled one is that label's list
    // wrapping to another line. Skills are never prose, so there is no other
    // reason for a line here to lack a label — except a flat list following
    // labelled groups, which is rare enough to accept.
    if (open) {
      open.text = `${open.text} ${text}`;
      continue;
    }

    open = { text };
    raw.push(open);
    open = null;
  }

  const groups: SkillGroup[] = [];
  for (const group of raw) {
    const items = splitSkillItems(group.text);
    if (items.length === 0) continue;
    if (group.category) groups.push({ category: group.category, items });
    else flat.push(...items);
  }

  // A label with no list after it was a lone skill after all.
  if (pendingLabel !== null) flat.push(pendingLabel);

  // Loose items become one uncategorised group rather than being dropped or
  // forced under the last label they happened to follow.
  if (flat.length > 0) groups.push({ items: flat });

  const confidence: Record<string, number> = {};
  groups.forEach((group, index) => {
    // A labelled group is far stronger evidence than a line that merely split
    // on commas, which is also how a prose sentence would split. The flat
    // case sits under the review threshold on purpose: it is worth a glance
    // — unless the vocabulary recognises most of it, in which case it is a
    // list of tools and the glance would be a wasted stop.
    let score = group.category ? 0.9 : 0.5;
    if (!group.category && vocabulary && knownShare(group.items, vocabulary) >= KNOWN_SHARE_TO_TRUST) {
      score = 0.8;
    }
    confidence[`skills.${index}.items`] = score;
  });

  return { value: groups, confidence };
}
