// Placeholder until the creative template lands; renders as minimal so the registry typechecks.
import type { Template } from "../types";
import { minimal } from "../minimal/meta";

export const creative: Template = { ...minimal, meta: { ...minimal.meta, id: "creative", name: "Creative" } };
