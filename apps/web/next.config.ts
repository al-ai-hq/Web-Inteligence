import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const config: NextConfig = {
  reactStrictMode: true,
  // Lint is not a build gate in this repo (baseline ~81 lint errors);
  // `next build` must not fail on the strict shared ESLint config.
  eslint: { ignoreDuringBuilds: true },
};

export default withNextIntl(config);
