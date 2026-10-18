import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";

const SRC_DIR = join(__dirname, "..");

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (entry === "node_modules" || entry === ".next") continue;
    if (statSync(path).isDirectory()) {
      files.push(...sourceFiles(path));
    } else if (path.endsWith(".tsx")) {
      files.push(path);
    }
  }
  return files;
}

function hasKey(namespace: string, key: string): boolean {
  const root = (en as Record<string, unknown>)[namespace];
  let node: unknown = root;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null || !(part in node)) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return true;
}

const NAMESPACE_PATTERNS = [
  /const\s+(\w+)\s*=\s*(?:await\s+)?getTranslations\(\s*\{[^}]*namespace:\s*"([\w-]+)"/g,
  /const\s+(\w+)\s*=\s*useTranslations\(\s*"([\w-]+)"/g,
];

describe("referenced message keys", () => {
  it("every literal translation key used in a component exists in the en catalog", () => {
    const missing: string[] = [];
    for (const file of sourceFiles(SRC_DIR)) {
      const source = readFileSync(file, "utf-8");
      const bindings = new Map<string, string>();
      for (const pattern of NAMESPACE_PATTERNS) {
        for (const match of source.matchAll(pattern)) {
          const [, name, namespace] = match;
          if (name !== undefined && namespace !== undefined) bindings.set(name, namespace);
        }
      }
      for (const [name, namespace] of bindings) {
        const calls = new RegExp(String.raw`(?<![\w$])${name}\(\s*"([a-zA-Z0-9_]+)"\s*[,)]`, "g");
        for (const match of source.matchAll(calls)) {
          const key = match[1];
          if (key === undefined) continue;
          if (!hasKey(namespace, key)) {
            const line = source.slice(0, match.index).split("\n").length;
            missing.push(
              `${namespace}.${key} (${file.replace(SRC_DIR, "src")}:${String(line)})`,
            );
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
