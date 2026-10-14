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
  // In serverless environments, use environment-aware detection
  if (process.env["VERCEL"]) {
    // Vercel deploys to /vercel/path0
    const vercelRoot = "/vercel/path0";
    if (existsSync(vercelRoot)) {
      return vercelRoot;
    }
    // Fallback to current working directory
    return process.cwd();
  }

  // For local development, navigate from package root
  const pkgRoot = packageRoot(import.meta.url);
  const candidate = join(pkgRoot, "..", "..");

  // Verify this is actually the repo root by checking for known markers
  if (existsSync(join(candidate, "config", "anonymous-eligibility.yaml"))) {
    return candidate;
  }

  // If marker not found, search upward from package root for repo markers
  let dir = pkgRoot;
  for (;;) {
    if (existsSync(join(dir, "config", "anonymous-eligibility.yaml"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      // Fallback to original calculation
      return candidate;
    }
    dir = parent;
  }
}

export const REPO_ROOT = findRepoRoot();
