import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { parse as parseYaml } from "yaml";
import { renderConfigSchema, type RenderConfig } from "./config/schema.js";
import { DEFAULT_RENDER_CONFIG } from "./config/defaults.js";
import { renderPage } from "./renderer.js";

export const RENDER_JOB_VERSION = "0.0.0";

export interface RenderJobResult {
  auditId: string;
  urlsRendered: number;
  urlsFailed: number;
  outputDir: string;
}

interface RenderManifestEntry {
  url: string;
  textByteLength: number;
}

interface RenderManifest {
  entries: RenderManifestEntry[];
  threshold: number;
}

function loadConfig(): RenderConfig {
  const configPath = "./config/render-limits.yaml";
  if (existsSync(configPath)) {
    const raw = parseYaml(readFileSync(configPath, "utf-8"));
    return renderConfigSchema.parse(raw);
  }
  return DEFAULT_RENDER_CONFIG;
}

export async function runRenderJob(): Promise<RenderJobResult> {
  const auditId = process.env["AUDIT_ID"];
  if (!auditId) {
    throw new Error("AUDIT_ID environment variable is required");
  }

  const outputDir = process.env["OUTPUT_DIR"] ?? "./output";
  const config = loadConfig();

  // Read render manifest
  const manifestPath = join(outputDir, auditId, "render-manifest.json");
  const manifest: RenderManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

  if (manifest.entries.length === 0) {
    return {
      auditId,
      urlsRendered: 0,
      urlsFailed: 0,
      outputDir,
    };
  }

  let urlsRendered = 0;
  let urlsFailed = 0;

  for (const entry of manifest.entries) {
    try {
      const result = await renderPage({ url: entry.url, config });

      // Write rendered evidence
      const urlHash = createHash("sha256").update(entry.url).digest("hex").slice(0, 16);
      const evidencePath = join(outputDir, auditId, "rendered", `${urlHash}.json`);
      mkdirSync(dirname(evidencePath), { recursive: true });
      writeFileSync(evidencePath, JSON.stringify(result, null, 2));

      urlsRendered++;
    } catch (error) {
      console.error(`Failed to render ${entry.url}:`, error);
      urlsFailed++;
    }
  }

  return {
    auditId,
    urlsRendered,
    urlsFailed,
    outputDir,
  };
}
