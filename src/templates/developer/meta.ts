// Placeholder until the developer template lands; renders as minimal so the registry typechecks.
import type { Template } from "../types";
import { minimal } from "../minimal/meta";

export const developer: Template = { ...minimal, meta: { ...minimal.meta, id: "developer", name: "Developer" } };
