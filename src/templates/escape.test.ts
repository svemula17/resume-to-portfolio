import { describe, expect, it } from "vitest";
import { displayUrl, escapeHtml, html, join, mailto, raw, safeUrl, tel } from "./escape";

describe("html tag", () => {
  it("escapes every interpolated string", () => {
    const name = `<script>alert("x")</script> & 'friends'`;
    expect(html`<h1>${name}</h1>`.__html).toBe(
      "<h1>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;friends&#39;</h1>",
    );
  });

  it("passes marked-up values through and escapes inside nested tags", () => {
    const inner = html`<em>${"<b>"}</em>`;
    expect(html`<p>${inner}</p>`.__html).toBe("<p><em>&lt;b&gt;</em></p>");
  });

  it("renders arrays by concatenation and falsy values as nothing", () => {
    const items = ["a<", "b"].map((item) => html`<li>${item}</li>`);
    expect(html`<ul>${items}</ul>`.__html).toBe("<ul><li>a&lt;</li><li>b</li></ul>");
    expect(html`<p>${false}${null}${undefined}</p>`.__html).toBe("<p></p>");
  });

  it("escapes in attribute position, including quotes", () => {
    const title = `" onmouseover="alert(1)`;
    expect(html`<a title="${title}">x</a>`.__html).toBe(
      '<a title="&quot; onmouseover=&quot;alert(1)">x</a>',
    );
  });

  it("join keeps markup intact", () => {
    expect(join([html`<i>a</i>`, html`<i>b</i>`], ", ").__html).toBe("<i>a</i>, <i>b</i>");
  });

  it("raw is the only way in for markup", () => {
    expect(raw("<hr>").__html).toBe("<hr>");
    expect(escapeHtml("<hr>")).toBe("&lt;hr&gt;");
  });
});

describe("safeUrl", () => {
  it.each([
    ["https://example.com/x", "https://example.com/x"],
    ["http://example.com", "http://example.com"],
    ["github.com/you", "https://github.com/you"],
    ["www.example.com", "https://www.example.com"],
    ["//example.com/p", "https://example.com/p"],
    ["mailto:a@b.co", "mailto:a@b.co"],
    ["tel:+15550100", "tel:+15550100"],
    ["  linkedin.com/in/x  ", "https://linkedin.com/in/x"],
  ])("accepts %s", (input, expected) => {
    expect(safeUrl(input)).toBe(expected);
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "data:text/html,<script>",
    "vbscript:x",
    "file:///etc/passwd",
    "notes",
    "",
    "   ",
    "http://exa mple.com",
  ])("rejects %j", (input) => {
    expect(safeUrl(input)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(safeUrl(undefined)).toBeNull();
  });
});

describe("display helpers", () => {
  it("displayUrl strips scheme, www and a trailing slash", () => {
    expect(displayUrl("https://www.github.com/you/")).toBe("github.com/you");
  });

  it("mailto and tel validate before linking", () => {
    expect(mailto("sai@example.com")).toBe("mailto:sai@example.com");
    expect(mailto("not an email")).toBeNull();
    expect(tel("(917) 516-6967")).toBe("tel:9175166967");
    expect(tel("+1 917 516 6967")).toBe("tel:+19175166967");
    expect(tel("12")).toBeNull();
  });
});
