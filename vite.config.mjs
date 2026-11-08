import { defineConfig } from "vite";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticLanding } from "./src/Introduction.tsx";

const demoVersion = createHash("sha256")
  .update(readFileSync(new URL("./public/demo.gif", import.meta.url)))
  .digest("hex")
  .slice(0, 12);

export default defineConfig(({ command, isPreview }) => {
  let landingMarkup;
  const development = command === "serve" && !isPreview;
  const connections = development
    ? "'self' ws://localhost:* ws://127.0.0.1:*"
    : "'self'";
  const policy = [
    "default-src 'none'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src ${connections}`,
    "worker-src 'self'",
    "base-uri 'self'",
    "form-action 'none'",
    "object-src 'none'",
  ].join("; ");
  const headers = {
    "Content-Security-Policy": policy + "; frame-ancestors 'self'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  };
  return {
    define: { "import.meta.env.VITE_DEMO_VERSION": JSON.stringify(demoVersion) },
    build: {
      rollupOptions: { input: ["index.html", "cases/signal-german-text/index.html"] },
    },
    server: { headers },
    preview: { headers },
    plugins: [
      {
        name: "render-inspector-intro",
        configResolved(config) {
          landingMarkup = renderToStaticMarkup(
            createElement(StaticLanding, { base: config.base, demoVersion }),
          );
        },
        transformIndexHtml(html) {
          return html.replace("<!--inspector-intro-->", () => landingMarkup);
        },
      },
      {
        name: "local-content-policy",
        transformIndexHtml() {
          return [
            {
              tag: "meta",
              attrs: {
                "http-equiv": "Content-Security-Policy",
                content: policy,
              },
              injectTo: "head-prepend",
            },
          ];
        },
        generateBundle() {
          this.emitFile({
            type: "asset",
            fileName: "_headers",
            source:
              "/*\n" +
              Object.entries(headers)
                .map(([name, value]) => `  ${name}: ${value}\n`)
                .join(""),
          });
        },
      },
    ],
  };
});
