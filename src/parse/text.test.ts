import { describe, expect, it } from "vitest";
import {
  DATE_RANGE,
  EMAIL,
  GPA,
  isAllCaps,
  isBulletLine,
  normalizeHeading,
  PHONE,
  stripBullet,
  US_LOCATION,
} from "./text";

describe("DATE_RANGE", () => {
  // An adversarial table. Every one of these appears on a real resume.
  const ranges: Array<[string, string, string]> = [
    ["Jan 2020 - Present", "Jan 2020", "Present"],
    ["January 2020 – Present", "January 2020", "Present"],
    ["Jan 2020 — Dec 2021", "Jan 2020", "Dec 2021"],
    ["Jan 2020 to Dec 2021", "Jan 2020", "Dec 2021"],
    ["Sept 2018 - Mar 2019", "Sept 2018", "Mar 2019"],
    ["06/2019 - 08/2021", "06/2019", "08/2021"],
    ["2015 - 2019", "2015", "2019"],
    ["June 2025 - Present", "June 2025", "Present"],
    ["Mar 2023 - Feb 2024", "Mar 2023", "Feb 2024"],
    ["Jan. 2020 - Current", "Jan. 2020", "Current"],
    ["2020-2024", "2020", "2024"],
  ];

  it.each(ranges)("parses %s", (input, start, end) => {
    const match = DATE_RANGE.exec(input);
    expect(match?.[1]).toBe(start);
    expect(match?.[2]).toBe(end);
  });

  it("does not match a lone year", () => {
    expect(DATE_RANGE.test("2019")).toBe(false);
  });

  it("does not match a phone number", () => {
    expect(DATE_RANGE.test("917-516-6967")).toBe(false);
  });
});

describe("PHONE", () => {
  const valid = [
    "917-516-6967",
    "(917) 516-6967",
    "917.516.6967",
    "9175166967",
    "+1 917 516 6967",
    "917-516-6967 x204",
  ];

  it.each(valid)("matches %s", (input) => {
    expect(PHONE.test(input)).toBe(true);
  });

  it("does not match a year range", () => {
    expect(PHONE.test("2015 - 2019")).toBe(false);
  });
});

describe("EMAIL", () => {
  it("pulls an address out of a delimited contact line", () => {
    const line = "Jersey City, NJ | 917-516-6967 | svemula127@gmail.com";
    expect(EMAIL.exec(line)?.[0]).toBe("svemula127@gmail.com");
  });

  it("rejects a bare domain", () => {
    expect(EMAIL.test("github.com/svemula17")).toBe(false);
  });
});

describe("US_LOCATION", () => {
  it("finds a city and state inside a longer line", () => {
    expect(US_LOCATION.exec("Datadog -- United States (Remote)")).toBeNull();
    expect(US_LOCATION.exec("Jersey City, NJ | 917-516-6967")?.[0]).toBe("Jersey City, NJ");
  });
});

describe("GPA", () => {
  it("captures a bare GPA and a fraction", () => {
    expect(GPA.exec("GPA: 3.87")?.[1]).toBe("3.87");
    const scaled = GPA.exec("GPA 3.87/4.0");
    expect(scaled?.[1]).toBe("3.87");
    expect(scaled?.[2]).toBe("4.0");
  });

  it("does not treat a version number as a GPA", () => {
    // 5.x is out of range, which is the only cheap defence available here.
    expect(GPA.test("Python 5.10")).toBe(false);
  });
});

describe("normalizeHeading", () => {
  it("strips a trailing colon and collapses whitespace", () => {
    expect(normalizeHeading("  Technical   Skills:  ")).toBe("technical skills");
  });
});

describe("isAllCaps", () => {
  it("ignores digits and punctuation", () => {
    expect(isAllCaps("SKILLS & TOOLS")).toBe(true);
    expect(isAllCaps("EDUCATION (2019)")).toBe(true);
    expect(isAllCaps("Technical Skills")).toBe(false);
  });

  it("is false for a string with no letters", () => {
    expect(isAllCaps("2019 - 2023")).toBe(false);
  });
});

describe("bullets", () => {
  it("recognises and strips the glyphs resumes actually use", () => {
    for (const bullet of ["• Built a thing", "- Built a thing", "▪ Built a thing"]) {
      expect(isBulletLine(bullet)).toBe(true);
      expect(stripBullet(bullet)).toBe("Built a thing");
    }
  });

  it("does not treat an en-dash date range as a bullet", () => {
    expect(isBulletLine("2015 - 2019")).toBe(false);
  });
});
