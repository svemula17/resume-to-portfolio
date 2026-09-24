import { statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import data from "./skills.json";
import { loadVocabulary, normaliseTerm, vocabularyFrom } from "./vocabulary";

const ONET_ATTRIBUTION =
  "This product includes information from the O*NET 29.1 Database by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the CC BY 4.0 license. O*NET® is a trademark of USDOL/ETA.";

describe("normaliseTerm", () => {
  it("trims, collapses whitespace and lowercases", () => {
    expect(normaliseTerm("  Micro   Soft\tExcel ")).toBe("micro soft excel");
    expect(normaliseTerm("TypeScript")).toBe("typescript");
  });

  it("strips the O*NET catalogue suffixes", () => {
    expect(normaliseTerm("Ansible software")).toBe("ansible");
    expect(normaliseTerm("Microsoft Project (software)")).toBe("microsoft project");
    expect(normaliseTerm("Bitcoin mining program")).toBe("bitcoin mining");
    // Only a trailing, space-separated suffix. "software" inside a name is
    // the name, and a bare "software" has no suffix to strip.
    expect(normaliseTerm("Alfresco Software Alfresco")).toBe("alfresco software alfresco");
    expect(normaliseTerm("software")).toBe("software");
    expect(normaliseTerm("Sitecore software.")).toBe("sitecore");
  });

  it("strips list punctuation but not spelling", () => {
    expect(normaliseTerm("Python,")).toBe("python");
    expect(normaliseTerm("Go.")).toBe("go");
    expect(normaliseTerm("React;")).toBe("react");
    expect(normaliseTerm("C++")).toBe("c++");
    expect(normaliseTerm("C#")).toBe("c#");
    expect(normaliseTerm(".NET")).toBe(".net");
    expect(normaliseTerm("Node.js")).toBe("node.js");
  });

  it("is idempotent", () => {
    for (const term of ["  Ansible software. ", "C++", "Node.js", "go"]) {
      const once = normaliseTerm(term);
      expect(normaliseTerm(once)).toBe(once);
    }
  });

  it("empties out on whitespace", () => {
    expect(normaliseTerm("   ")).toBe("");
    expect(normaliseTerm("")).toBe("");
  });
});

describe("vocabularyFrom", () => {
  const vocabulary = vocabularyFrom(["Python", "go", "Node.js", "vue", "React software", " c++ "], ["python"]);

  it("normalises on the way in and on lookup", () => {
    expect(vocabulary.has("python")).toBe(true);
    expect(vocabulary.has("  PYTHON, ")).toBe(true);
    expect(vocabulary.has("React")).toBe(true);
    expect(vocabulary.has("C++")).toBe(true);
    expect(vocabulary.has("rust")).toBe(false);
    expect(vocabulary.has("")).toBe(false);
    expect(vocabulary.has("   ")).toBe(false);
  });

  it("counts distinct normalised terms", () => {
    expect(vocabulary.size).toBe(6);
    expect(vocabularyFrom(["Go", "go", "GO."]).size).toBe(1);
    expect(vocabularyFrom([]).size).toBe(0);
  });

  it("matches every js spelling when any one is present", () => {
    // The set has "node.js".
    expect(vocabulary.has("node.js")).toBe(true);
    expect(vocabulary.has("NodeJS")).toBe(true);
    expect(vocabulary.has("Node JS")).toBe(true);
    expect(vocabulary.has("node")).toBe(false);

    // The set has bare "vue": every js spelling of it hits.
    expect(vocabulary.has("vue.js")).toBe(true);
    expect(vocabulary.has("vuejs")).toBe(true);
    expect(vocabulary.has("vue js")).toBe(true);

    // The set has "reactjs" only: the other spellings hit, the base does not.
    const spelled = vocabularyFrom(["reactjs"]);
    expect(spelled.has("react.js")).toBe(true);
    expect(spelled.has("react js")).toBe(true);
    expect(spelled.has("react")).toBe(false);

    // Nothing to strip to.
    expect(vocabulary.has("js")).toBe(false);
    expect(vocabulary.has(".js")).toBe(false);
  });

  it("keeps hot separate from has", () => {
    expect(vocabulary.isHot("Python")).toBe(true);
    expect(vocabulary.isHot("go")).toBe(false);
    expect(vocabulary.isHot("rust")).toBe(false);
    expect(vocabularyFrom(["go"]).isHot("go")).toBe(false);
  });

  it("applies the js rule to hot too", () => {
    expect(vocabularyFrom(["node.js"], ["node.js"]).isHot("nodejs")).toBe(true);
  });
});

describe("skills.json", () => {
  const skills = data.skills;
  const set = new Set(skills);

  it("is version 1 with a generation stamp", () => {
    expect(data.version).toBe(1);
    expect(Number.isNaN(Date.parse(data.generated))).toBe(false);
  });

  it("lists exactly the three permissively licensed sources", () => {
    expect(data.sources.map((source) => source.license)).toEqual(["CC BY 4.0", "MIT", "MIT"]);
    for (const source of data.sources) {
      expect(source.name.length).toBeGreaterThan(0);
      expect(source.url).toMatch(/^https:\/\//);
      expect(source.attribution.length).toBeGreaterThan(0);
    }
  });

  it("carries the O*NET attribution verbatim", () => {
    expect(data.sources[0]?.attribution).toBe(ONET_ATTRIBUTION);
  });

  it("is sorted, deduplicated and normalised", () => {
    expect(set.size).toBe(skills.length);
    expect([...skills].sort()).toEqual(skills);
    for (const term of skills) {
      expect(term).toBe(normaliseTerm(term));
      expect(term.length).toBeLessThanOrEqual(60);
      expect(term.length).toBeGreaterThan(0);
    }
  });

  it("keeps the languages that are one letter long and nothing else that short", () => {
    const single = skills.filter((term) => term.length === 1);
    expect(single).toEqual(["c", "d", "j", "q", "r"]);
  });

  it("has the terms a developer resume leans on", () => {
    for (const term of ["python", "go", "typescript", "kubernetes", "terraform", "c", "r"]) {
      expect(set.has(term), term).toBe(true);
    }
  });

  it("has the O*NET suffix stripped", () => {
    expect(set.has("ansible")).toBe(true);
    expect(skills.filter((term) => / software$/.test(term))).toEqual([]);
  });

  it("stays under the size budget", () => {
    const { size } = statSync(new URL("./skills.json", import.meta.url));
    expect(size).toBeLessThan(220 * 1024);
  });

  it("has hot as a subset of skills", () => {
    expect(data.hot.length).toBeGreaterThan(0);
    for (const term of data.hot) expect(set.has(term), term).toBe(true);
    expect(new Set(data.hot).size).toBe(data.hot.length);
  });
});

describe("loadVocabulary", () => {
  it("loads the committed data once", async () => {
    const first = await loadVocabulary();
    const second = await loadVocabulary();
    expect(second).toBe(first);
    expect(first.size).toBe(data.skills.length);
    expect(first.has("Kubernetes")).toBe(true);
    expect(first.has("this is not a skill, it is a sentence")).toBe(false);
  });
});
