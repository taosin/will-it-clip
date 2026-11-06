import { defineConfig } from "vite";

export default defineConfig(({ command, isPreview }) => {
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
    server: { headers },
    preview: { headers },
    plugins: [
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
