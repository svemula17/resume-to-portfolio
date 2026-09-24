import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CSP } from "../vite.config";

describe("content security policy", () => {
  it("says the same thing in the meta tag and the Vercel header", () => {
    const vercel = JSON.parse(readFileSync(join(__dirname, "..", "vercel.json"), "utf8")) as {
      headers: Array<{ headers: Array<{ key: string; value: string }> }>;
    };
    const header = vercel.headers[0]!.headers.find((h) => h.key === "Content-Security-Policy")!.value;
    // The header may add frame-ancestors, which a meta tag cannot express.
    expect(header.replace(/;\s*frame-ancestors[^;]*/, "")).toBe(CSP);
  });

  it("allows nothing from another origin", () => {
    expect(CSP).not.toMatch(/https?:/);
    expect(CSP).toContain("connect-src 'self'");
    expect(CSP).toContain("script-src 'self'");
    expect(CSP).not.toMatch(/script-src[^;]*unsafe/);
  });
});
