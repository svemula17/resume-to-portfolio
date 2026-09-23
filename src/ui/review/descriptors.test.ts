/**
 * The run-time half of "generated from the schema".
 *
 * descriptors.ts is compile-checked against the schema's inferred types, but
 * types cannot say that a checkbox is wrong for a string or that `core` only
 * makes sense on a field that can be empty text. This test walks the Zod
 * schema itself and checks those things. It is the only file allowed to
 * touch `_zod.def`: if a Zod bump renames anything here, this test fails in
 * CI and the app — which never introspects — keeps rendering.
 *
 * Nothing here is skipped or tolerant. An unknown Zod node type is a failure
 * with the field's path, because a silently unhandled type is exactly the
 * drift the test exists to catch.
 */
import { describe, expect, it } from "vitest";
import { BasicsSchema, ResumeSchema } from "../../schema/resume";
import { BASICS_FIELDS, SECTIONS, type FieldDescriptor, type Widget } from "./descriptors";
import { LIST_PATHS, type ListPath } from "./keys";

// ---------------------------------------------------------------------------
// Introspection helpers. Structural, not Zod's own types: `_zod.def` is `any`
// at the core level, and naming only the four properties we read keeps the
// rest of the test strictly typed.
// ---------------------------------------------------------------------------

interface ZodNode {
  _zod: { def: ZodDef };
}

interface ZodDef {
  type: string;
  innerType?: ZodNode;
  element?: ZodNode;
  shape?: Record<string, ZodNode>;
  checks?: Array<{ _zod: { def: { check: string } } }>;
}

/** The wrapper types Zod puts around a field that need not be supplied. */
const WRAPPERS = new Set(["optional", "default"]);

function defOf(node: ZodNode): ZodDef {
  return node._zod.def;
}

/**
 * Peel `optional`/`default` wrappers off a node.
 *
 * `required` is about the node's own chain only, not its ancestors: a link's
 * `url` is required *within a link* even though `links` defaults to `[]`.
 * That is the reading §8 depends on — the schema can only ever complain
 * about a leaf the parent object actually holds.
 */
function unwrap(node: ZodNode): { kind: string; inner: ZodNode; required: boolean } {
  let inner = node;
  let required = true;
  while (WRAPPERS.has(defOf(inner).type)) {
    required = false;
    const next = defOf(inner).innerType;
    if (!next) throw new Error(`${defOf(inner).type} wrapper without an innerType`);
    inner = next;
  }
  return { kind: defOf(inner).type, inner, required };
}

function shapeOf(node: ZodNode, at: string): Record<string, ZodNode> {
  const { kind, inner } = unwrap(node);
  const shape = defOf(inner).shape;
  if (kind !== "object" || !shape) throw new Error(`${at}: expected an object schema, got ${kind}`);
  return shape;
}

function elementOf(node: ZodNode, at: string): ZodNode {
  const { kind, inner } = unwrap(node);
  const element = defOf(inner).element;
  if (kind !== "array" || !element) throw new Error(`${at}: expected an array schema, got ${kind}`);
  return element;
}

/** The element schema of a list, found by walking the dotted path from the root. */
function listElementSchema(path: ListPath): ZodNode {
  let node: ZodNode = ResumeSchema;
  let at = "";
  for (const segment of path.split(".")) {
    at = at ? `${at}.${segment}` : segment;
    const shape = shapeOf(node, at);
    const next = shape[segment];
    if (!next) throw new Error(`${at}: not in the schema`);
    node = next;
  }
  return elementOf(node, path);
}

function hasMinLength(node: ZodNode): boolean {
  return (defOf(node).checks ?? []).some((check) => check._zod.def.check === "min_length");
}

/**
 * Every leaf path of the schema with no wrapper on the leaf's own chain.
 * Arrays of objects contribute a `*` segment, arrays of primitives are
 * leaves themselves.
 */
function requiredLeaves(node: ZodNode, at: string, out: string[] = []): string[] {
  const { kind, inner, required } = unwrap(node);
  if (kind === "object") {
    for (const [key, child] of Object.entries(shapeOf(inner, at))) {
      requiredLeaves(child, at ? `${at}.${key}` : key, out);
    }
    return out;
  }
  if (kind === "array") {
    const element = elementOf(inner, at);
    if (unwrap(element).kind === "object") return requiredLeaves(element, `${at}.*`, out);
  }
  if (required) out.push(at);
  return out;
}

// ---------------------------------------------------------------------------
// The compatibility table (§3.2).
// ---------------------------------------------------------------------------

const SELECT_HINT =
  "add a select widget: extend the Widget union, add a FieldInput case, put options on the descriptor";

/**
 * Which widgets may present a field of a given shape. Returns the allowed
 * set, or throws naming the path and what to build when nothing fits.
 */
function allowedWidgets(node: ZodNode, at: string): ReadonlySet<Widget> {
  const { kind, inner } = unwrap(node);
  switch (kind) {
    case "string":
      return new Set<Widget>(["text", "textarea"]);
    case "boolean":
      return new Set<Widget>(["checkbox"]);
    case "array": {
      const element = unwrap(elementOf(inner, at)).kind;
      if (element === "string") return new Set<Widget>(["lines", "tags"]);
      if (element === "object") return new Set<Widget>(["list"]);
      throw new Error(`${at}: no widget presents array<${element}>; add one to FieldInput and this table`);
    }
    case "enum":
      throw new Error(`${at}: schema is an enum — ${SELECT_HINT}`);
    default:
      throw new Error(`${at}: no widget presents a ${kind} field; add one to FieldInput and this table`);
  }
}

/** One descriptor table beside the schema shape it describes. */
interface Table {
  at: string;
  fields: Record<string, FieldDescriptor>;
  shape: Record<string, ZodNode>;
}

const TABLES: Table[] = [
  { at: "basics", fields: BASICS_FIELDS, shape: shapeOf(BasicsSchema, "basics") },
  ...LIST_PATHS.map(
    (path): Table => ({
      at: `${path}.*`,
      fields: SECTIONS[path].fields as Record<string, FieldDescriptor>,
      shape: shapeOf(listElementSchema(path), `${path}.*`),
    }),
  ),
];

// ---------------------------------------------------------------------------

describe("introspection helpers", () => {
  it("unwrap peels optional and default and reports the inner kind", () => {
    const basics = shapeOf(BasicsSchema, "basics");
    expect(unwrap(basics.name!)).toMatchObject({ kind: "string", required: true });
    expect(unwrap(basics.title!)).toMatchObject({ kind: "string", required: false });
    expect(unwrap(basics.links!)).toMatchObject({ kind: "array", required: false });
  });

  it("finds every list element schema by path", () => {
    for (const path of LIST_PATHS) {
      expect(unwrap(listElementSchema(path)).kind, path).toBe("object");
    }
  });
});

describe("descriptor tables match the schema", () => {
  it("BasicsSchema and every list element are covered", () => {
    expect(TABLES.map((table) => table.at)).toEqual(["basics", ...LIST_PATHS.map((path) => `${path}.*`)]);
  });

  it.each(TABLES)("$at: descriptor keys equal schema keys, both directions", ({ fields, shape }) => {
    const described = Object.keys(fields).sort();
    const declared = Object.keys(shape).sort();
    expect(described).toEqual(declared);
  });

  it.each(TABLES)("$at: every widget suits its field's type", ({ at, fields, shape }) => {
    for (const [name, descriptor] of Object.entries(fields)) {
      const node = shape[name];
      if (!node) throw new Error(`${at}.${name}: not in the schema`);
      const allowed = allowedWidgets(node, `${at}.${name}`);
      expect(
        allowed.has(descriptor.widget),
        `${at}.${name}: widget "${descriptor.widget}" cannot present this field; use one of ${[...allowed].join("|")}`,
      ).toBe(true);
    }
  });

  it.each(TABLES)("$at: core fields are strings", ({ at, fields, shape }) => {
    for (const [name, descriptor] of Object.entries(fields)) {
      if (!descriptor.core) continue;
      const node = shape[name];
      if (!node) throw new Error(`${at}.${name}: not in the schema`);
      // A seeded "Missing" stop asks the user to type something; only a
      // string field can be answered that way.
      expect(unwrap(node).kind, `${at}.${name} is core but not a string`).toBe("string");
    }
  });

  it("the compatibility table rejects what no widget can show", () => {
    const fake = (type: string, extra: Partial<ZodDef> = {}): ZodNode => ({ _zod: { def: { type, ...extra } } });
    expect(() => allowedWidgets(fake("enum"), "x.kind")).toThrow(/x\.kind.*add a select widget/);
    expect(() => allowedWidgets(fake("number"), "x.count")).toThrow(/x\.count.*number/);
    expect(() => allowedWidgets(fake("object", { shape: {} }), "x.nested")).toThrow(/x\.nested.*object/);
    expect(() => allowedWidgets(fake("array", { element: fake("number") }), "x.nums")).toThrow(
      /x\.nums.*array<number>/,
    );
    expect(allowedWidgets(fake("optional", { innerType: fake("boolean") }), "x.flag")).toEqual(
      new Set(["checkbox"]),
    );
  });
});

describe("required leaves", () => {
  it("are exactly basics.name and basics.links.*.url", () => {
    // §8 rests on this: normalise drops url-less links, so basics.name is
    // the only issue the form can ever show. A third required leaf would
    // need a third validation path.
    expect(requiredLeaves(ResumeSchema, "").sort()).toEqual(["basics.links.*.url", "basics.name"]);
  });

  it("basics.name is the one leaf with a min_length check", () => {
    const withMin = Object.entries(shapeOf(BasicsSchema, "basics"))
      .filter(([, node]) => hasMinLength(unwrap(node).inner))
      .map(([name]) => name);
    expect(withMin).toEqual(["name"]);
  });
});
