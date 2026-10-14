import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const config: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Lint is not a build gate in this repo (baseline ~81 lint errors);
  // `next build` must not fail on the strict shared ESLint config.
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // @wpi/render-job must be loaded at runtime instead of bundled: its
      // playwright dependency's optional chromium-bidi imports are not
      // webpack-resolvable. `serverExternalPackages` cannot match pnpm
      // workspace links (their real paths live outside node_modules), and
      // the package is ESM-only (no `require` condition), so externalize
      // the exact request as a runtime `import()`.
      config.externals = config.externals || [];
      config.externals.push((context, request, callback) => {
        if (request === "@wpi/render-job") {
          return callback(null, `module ${request}`);
        }
        callback();
      });
    }
    return config;
  },
};

export default withNextIntl(config);
