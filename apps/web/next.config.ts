import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  i18n: {
    locales: ["en", "ar"],
    defaultLocale: "en",
  },
};

export default config;
