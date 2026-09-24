import type { Template } from "../types";
import { css } from "./css";
import { render } from "./html";

export const minimal: Template = {
  meta: {
    id: "minimal",
    name: "Minimal",
    description: "One quiet column. Type does the work; nothing competes with the content.",
    traits: ["Single column", "Serif headings", "Print-first", "Dark mode"],
  },
  render: (resume, options) => ({ "index.html": render(resume, options), "styles.css": css }),
};
