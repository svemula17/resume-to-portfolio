import type { Template } from "../types";
import { css } from "./css";
import { render } from "./html";

export const developer: Template = {
  meta: {
    id: "developer",
    name: "Developer",
    description: "A sticky rail of who you are beside a column of what you have shipped, with monospace accents and tech chips.",
    traits: ["Two column", "Mono accents", "Tech chips", "Dark-native"],
  },
  render: (resume, options) => ({ "index.html": render(resume, options), "styles.css": css }),
};
