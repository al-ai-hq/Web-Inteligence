import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3100",
  },
  webServer: {
    command: "pnpm dev --port 3100",
    url: "http://127.0.0.1:3100/en",
    env: {
      WPI_DISPATCH_MODE: "stub",
      COOKIE_SECRET: "e2e-cookie-secret",
      PORT: "3100",
    },
    timeout: 120000,
    reuseExistingServer: !process.env["CI"],
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
