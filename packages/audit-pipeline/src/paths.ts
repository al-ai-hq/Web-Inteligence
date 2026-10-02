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
      throw new Error("Could not locate package root (no package.json ancestor)");
    }
    dir = parent;
  }
}

export const REPO_ROOT = join(packageRoot(import.meta.url), "..", "..");
