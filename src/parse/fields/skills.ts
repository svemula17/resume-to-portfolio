/**
 * Skills.
 *
 * Two layouts cover nearly everything: labelled groups
 * ("Languages: Python, Go") and a flat list. Both reduce to the same shape,
 * with `category` simply absent for the flat case.
 */
import type { Line } from "../../layout";
import type { SkillGroup } from "../../schema/resume";
import { isBulletLine, stripBullet } from "../text";

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

export function parseSkills(lines: Line[]): {
  value: SkillGroup[];
  confidence: Record<string, number>;
} {
  // Raw text is accumulated per group and split once at the end, rather than
  // line by line. A list that wraps mid-parenthesis — "AWS (IAM, KMS, Secrets"
  // on one line and "Manager), Terraform" on the next — can only be split
  // correctly once both halves are back together.
  const raw: Array<{ category?: string; text: string }> = [];
  let open: { category?: string; text: string } | null = null;

  for (const line of lines) {
    const text = isBulletLine(line.text) ? stripBullet(line.text) : line.text.trim();
    if (text === "") continue;

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
  const flat: string[] = [];
  for (const group of raw) {
    const items = splitSkillItems(group.text);
    if (items.length === 0) continue;
    if (group.category) groups.push({ category: group.category, items });
    else flat.push(...items);
  }

  // Loose items become one uncategorised group rather than being dropped or
  // forced under the last label they happened to follow.
  if (flat.length > 0) groups.push({ items: flat });

  const confidence: Record<string, number> = {};
  groups.forEach((group, index) => {
    // A labelled group is far stronger evidence than a line that merely split
    // on commas, which is also how a prose sentence would split.
    confidence[`skills.${index}.items`] = group.category ? 0.9 : 0.6;
  });

  return { value: groups, confidence };
}
