import type { Template } from "../types";
import { css } from "./css";
import { render } from "./html";

export const creative: Template = {
  meta: {
    id: "creative",
    name: "Creative",
    description: "Editorial and bold: a display name on a warm band, a timeline, and a card grid.",
    traits: ["Display serif", "Timeline", "Card grid", "Dark mode"],
  },
  render: (resume, options) => ({ "index.html": render(resume, options), "styles.css": css }),
};
