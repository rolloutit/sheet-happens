import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  output: "standalone",
  /**
   * The Typst templates and bundled fonts are read from disk at render time, so the tracer has
   * to copy them into `.next/standalone`. Next's standalone server `chdir()`s into that
   * directory, which is what `resolveTypstTemplatesDir` anchors on.
   */
  outputFileTracingIncludes: {
    "/admin/reports/export": ["./src/server/pdf/templates/**/*", "./src/server/pdf/fonts/**/*"],
    "/admin/reports/export/preview": [
      "./src/server/pdf/templates/**/*",
      "./src/server/pdf/fonts/**/*",
    ],
    "/admin/system": ["./src/server/pdf/templates/**/*", "./src/server/pdf/fonts/**/*"],
    "/api/admin/system-check": ["./src/server/pdf/templates/**/*", "./src/server/pdf/fonts/**/*"],
  },
  reactStrictMode: true,
  typedRoutes: true,
};

export default withNextIntl(nextConfig);
