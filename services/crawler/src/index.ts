import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { parse as parseYaml } from "yaml";

import { crawlConfigSchema, type CrawlConfig } from "./config/schema.js";
import { DEFAULT_CRAWL_CONFIG } from "./config/defaults.js";
import { planUrls, type SamplingMode } from "./url-planner.js";
import { fetchUrl } from "./fetcher.js";
import { extractContent } from "./extractor.js";
import { resolveMaxPages } from "./max-pages.js";
import { validateUrl } from "@wpi/security";
import {
  createManifest,
  addToManifest,
  serializeManifest,
  type RenderManifest,
} from "./render-manifest.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RawEvidence {
  url: string;
  finalUrl: string;
  statusCode: number;
  contentHash: string;
  redirectChain: string[];
  contentType?: string;
  headings: Array<{ level: number; text: string }>;
  links: string[];
  language?: string;
  direction?: string;
  structuredData: unknown[];
  textByteLength: number;
  fetchedAt: string;
}

export interface CrawlResult {
  auditId: string;
  urlsPlanned: number;
  urlsFetched: number;
  urlsFailed: number;
  renderManifestEntries: number;
  outputDir: string;
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

function loadConfig(): CrawlConfig {
  const configPath = "./config/crawl-limits.yaml";
  if (existsSync(configPath)) {
    const raw = parseYaml(readFileSync(configPath, "utf-8"));
    return crawlConfigSchema.parse(raw);
  }
  return DEFAULT_CRAWL_CONFIG;
}

// ---------------------------------------------------------------------------
// Concurrency control
// ---------------------------------------------------------------------------

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const executing = new Set<Promise<void>>();
  for (const item of items) {
    const p: Promise<void> = fn(item).then(() => {
      executing.delete(p);
    });
    executing.add(p);
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function runCrawlJob(): Promise<CrawlResult> {
  // 1. Read and validate env vars
  const auditId = process.env["AUDIT_ID"];
  if (!auditId) {
    throw new Error("AUDIT_ID environment variable is required");
  }

  const rootUrl = process.env["ROOT_URL"];
  if (!rootUrl) {
    throw new Error("ROOT_URL environment variable is required");
  }

  const samplingMode = (process.env["SAMPLING_MODE"] ?? "single_page") as SamplingMode;
  const sitemapUrl = process.env["SITEMAP_URL"];
  const outputDir = process.env["OUTPUT_DIR"] ?? "./output";

  // 2. Load config
  const config = loadConfig();

  // 3. Fetch sitemap XML if SITEMAP_URL provided (with SSRF validation)
  let sitemapXml: string | undefined;
  if (sitemapUrl) {
    try {
      const validation = await validateUrl(sitemapUrl);
      if (!validation.valid) {
        console.warn(`Warning: Sitemap URL failed SSRF validation: ${validation.reason}`);
      } else {
        const response = await fetch(sitemapUrl);
        sitemapXml = await response.text();
      }
    } catch {
      console.warn(`Warning: Failed to fetch sitemap from ${sitemapUrl}, continuing without sitemap`);
    }
  }

  // 4. Plan URLs
  const urls = await planUrls({
    rootUrl,
    samplingMode,
    maxPages: resolveMaxPages(config.max_pages, process.env["MAX_PAGES"]),
    maxDepth: config.max_depth,
    sitemapXml,
  });

  // 5. Fetch, extract, write evidence for each URL
  let urlsFetched = 0;
  let urlsFailed = 0;
  let manifest: RenderManifest = createManifest(config.render_text_threshold_bytes);

  await runWithConcurrency(urls, config.concurrency, async (url: string) => {
    try {
      // a. Fetch URL
      const fetchResult = await fetchUrl(url, config);

      // b. Extract content
      const extracted = extractContent(fetchResult.body, fetchResult.finalUrl);

      // c. Build raw evidence
      const evidence: RawEvidence = {
        url,
        finalUrl: fetchResult.finalUrl,
        statusCode: fetchResult.statusCode,
        contentHash: fetchResult.contentHash,
        redirectChain: fetchResult.redirectChain,
        contentType: fetchResult.contentType,
        headings: extracted.headings,
        links: extracted.links,
        language: extracted.language,
        direction: extracted.direction,
        structuredData: extracted.structuredData,
        textByteLength: extracted.textByteLength,
        fetchedAt: new Date().toISOString(),
      };

      // d. Write evidence file
      const urlHash = createHash("sha256").update(url).digest("hex").slice(0, 16);
      const evidencePath = join(outputDir, auditId, "raw", `${urlHash}.json`);
      mkdirSync(dirname(evidencePath), { recursive: true });
      writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));

      // e. Check if shouldRender — add to manifest if thin HTML
      manifest = addToManifest(manifest, url, extracted.textByteLength);

      urlsFetched++;
    } catch (error) {
      console.error(`Error processing ${url}:`, error instanceof Error ? error.message : error);
      urlsFailed++;
    }
  });

  // 6. Write render manifest
  const manifestDir = join(outputDir, auditId);
  mkdirSync(manifestDir, { recursive: true });
  const manifestPath = join(manifestDir, "render-manifest.json");
  writeFileSync(manifestPath, serializeManifest(manifest));

  // 7. Return CrawlResult
  return {
    auditId,
    urlsPlanned: urls.length,
    urlsFetched,
    urlsFailed,
    renderManifestEntries: manifest.entries.length,
    outputDir,
  };
}

export { resolveMaxPages } from "./max-pages.js";
