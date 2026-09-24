import { describe, expect, it } from "vitest";
import { detrack, isTracked } from "./tracking";

describe("isTracked", () => {
  it.each(["S U M M A RY", "E X P E R I E N C E", "C O N TA C T", "E D U C AT I O N", "F R O N T E N D E N G I N E E R"])(
    "recognises %j",
    (text) => expect(isTracked(text)).toBe(true),
  );

  it.each(["SUMMARY", "Senior Engineer", "A B C", "J. R. R. Tolkien", "Go, Rust, C", "I am a fan of AI"])(
    "does not flag %j",
    (text) => expect(isTracked(text)).toBe(false),
  );
});

describe("detrack", () => {
  it("collapses a tracked heading, kerned pairs and all", () => {
    expect(detrack("S U M M A RY")).toBe("SUMMARY");
    expect(detrack("C O N TA C T")).toBe("CONTACT");
    expect(detrack("E D U C AT I O N")).toBe("EDUCATION");
    expect(detrack("P R O F E S S I O N A L E X P E R I E N C E")).toBe("PROFESSIONAL EXPERIENCE");
  });

  it("puts word boundaries back where a known word is recognisable", () => {
    expect(detrack("F R O N T E N D E N G I N E E R")).toBe("FRONTEND ENGINEER");
    expect(detrack("S I T E R E L I A B I L I T Y E N G I N E E R")).toBe("SITE RELIABILITY ENGINEER");
    expect(detrack("D ATA E N G I N E E R I N G L E A D")).toBe("DATA ENGINEERING LEAD");
  });

  it("leaves ordinary text alone", () => {
    expect(detrack("Senior Engineer")).toBe("Senior Engineer");
  });
});
