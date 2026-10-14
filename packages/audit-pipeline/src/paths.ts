import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function packageRoot(metaUrl: string): string {
  let dir = dirname(fileURLToPath(metaUrl));
  for (;;) {
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      // In serverless environments (Vercel, AWS Lambda), package.json may not be accessible.
      // Return the current directory as a fallback.
      return dirname(fileURLToPath(metaUrl));
    }
    dir = parent;
  }
}

function findRepoRoot(): string {
  // In Vercel, config is copied to multiple locations during build
  if (process.env["VERCEL"]) {
    const possiblePaths = [
      "/vercel/path0/apps/web/config/anonymous-eligibility.yaml",
      "/vercel/path0/.next/server/config/anonymous-eligibility.yaml",
      "/vercel/path0/config/anonymous-eligibility.yaml",
    ];
    for (const configPath of possiblePaths) {
      if (existsSync(configPath)) {
        return dirname(dirname(configPath));
      }
    }
  }

  // Search upward from the current file location for the config directory marker
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    // Check if this directory contains the config marker
    if (existsSync(join(dir, "config", "anonymous-eligibility.yaml"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      // Reached filesystem root without finding marker
      // Fallback: in Vercel, try /vercel/path0
      if (process.env["VERCEL"] && existsSync("/vercel/path0/config/anonymous-eligibility.yaml")) {
        return "/vercel/path0";
      }
      // Last resort: return current working directory
      return process.cwd();
    }
    dir = parent;
  }
}

export const REPO_ROOT = findRepoRoot();
