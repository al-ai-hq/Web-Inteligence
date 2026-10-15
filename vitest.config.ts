import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["apps/*", "services/*", "packages/*"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
