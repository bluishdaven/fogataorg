import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { RIGHTS_RESERVED_HEADERS } from "./src/lib/domain/seo";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  // Writers' work isn't for AI training: the TDM opt-out on every response (see seo.ts).
  ...RIGHTS_RESERVED_HEADERS,
];

const nextConfig: NextConfig = {
  // Static shell + streamed dynamic holes. See docs/plans/phase-0.md.
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Share-preview routes read their fonts and the flame from disk; make sure serverless bundles carry them.
  outputFileTracingIncludes: {
    "/api/og/**": ["./src/assets/fonts/*.woff", "./public/brand/fogata-flame.svg"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Everything but story embeds (/embed/…, framable anywhere through their own CSP) stays unframable.
      { source: "/:path((?!embed/).*)", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }] },
    ];
  },
};

export default withNextIntl(nextConfig);
