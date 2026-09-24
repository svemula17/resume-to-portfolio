import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * The policy the app runs under. On Vercel it is also sent as a header
 * (vercel.json); GitHub Pages cannot set headers, so it is injected here as
 * a meta tag too. The two must say the same thing — this constant is the
 * source and vercel.json is checked against it in vite.config.test.ts.
 *
 * Only at build time. The dev server injects an inline script for React
 * Fast Refresh, which 'self' would block.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "frame-src blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

function cspMeta(): Plugin {
  return {
    name: "csp-meta",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

// `base` is the one deploy-specific value. Vercel serves at "/", GitHub
// Pages serves under "/<repo>/", and everything that must be right in both
// — the pdf.js worker path, asset URLs — is built from import.meta.env.BASE_URL
// rather than hard-coded. The Pages workflow sets VITE_BASE; nothing else does.
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react(), cspMeta()],
});
