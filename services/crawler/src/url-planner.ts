import { parseSitemap } from "@wpi/security";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SamplingMode =
  "single_page" | "priority_pages" | "representative_sample" | "full_bounded";

export interface PlanUrlsOptions {
  rootUrl: string;
  samplingMode: SamplingMode;
  maxPages: number;
  maxDepth: number;
  sitemapXml?: string;
  fetchAndParse?: (url: string) => Promise<string[]>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a URL for deduplication: trim whitespace, lowercase scheme+host.
 * Keeps the rest of the path as-is.
 */
function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  // Lowercase scheme and hostname only
  return trimmed.replace(/^([a-zA-Z]+:\/\/[^/?#]+)/, (_match, authority: string) =>
    authority.toLowerCase(),
  );
}

/**
 * Extract origin (protocol + hostname + port) from a URL string.
 * Returns lowercase for consistent comparison.
 */
function getOrigin(url: string): string {
  const match = /^([a-zA-Z]+:\/\/[^/?#]+)/.exec(url.trim());
  return match ? (match[1] ?? "").toLowerCase() : "";
}

// ---------------------------------------------------------------------------
// mergeSitemapAndBfs
// ---------------------------------------------------------------------------

/**
 * Merge sitemap URLs with BFS URLs, deduplicate (case-insensitive),
 * sitemap URLs first, cap at maxPages.
 */
export function mergeSitemapAndBfs(
  sitemapUrls: string[],
  bfsUrls: string[],
  maxPages: number,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const addUnique = (urls: string[]): void => {
    for (const url of urls) {
      const key = normalizeUrl(url).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(url);
        if (result.length >= maxPages) return;
      }
    }
  };

  addUnique(sitemapUrls);
  addUnique(bfsUrls);

  return result.slice(0, maxPages);
}

// ---------------------------------------------------------------------------
// bfsCrawl
// ---------------------------------------------------------------------------

/**
 * BFS crawl from rootUrl. Follows links up to maxDepth, caps at maxPages.
 * Only follows links that share the same origin as rootUrl.
 */
export async function bfsCrawl(
  rootUrl: string,
  maxPages: number,
  maxDepth: number,
  fetchAndParse: (url: string) => Promise<string[]>,
): Promise<string[]> {
  const rootOrigin = getOrigin(rootUrl);
  const visited = new Set<string>();
  const result: string[] = [];

  // Queue entries: [url, depth]
  const queue: Array<[string, number]> = [[rootUrl, 0]];
  const rootKey = normalizeUrl(rootUrl).toLowerCase();
  visited.add(rootKey);

  while (queue.length > 0 && result.length < maxPages) {
    const entry = queue.shift();
    if (!entry) break;

    const [url, depth] = entry;
    result.push(url);

    if (result.length >= maxPages) break;

    if (depth < maxDepth) {
      const links = await fetchAndParse(url);
      for (const link of links) {
        const linkKey = normalizeUrl(link).toLowerCase();
        if (visited.has(linkKey)) continue;
        visited.add(linkKey);

        // Only follow same-origin links
        if (getOrigin(link) !== rootOrigin) continue;

        queue.push([link, depth + 1]);
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// planUrls
// ---------------------------------------------------------------------------

/**
 * Main entry point — dispatches based on sampling mode.
 */
export async function planUrls(options: PlanUrlsOptions): Promise<string[]> {
  const { rootUrl, samplingMode, maxPages, maxDepth, sitemapXml, fetchAndParse } = options;

  switch (samplingMode) {
    case "single_page":
      return [rootUrl];

    case "priority_pages": {
      const entries = sitemapXml ? parseSitemap(sitemapXml) : [];
      const topN = entries.slice(0, maxPages - 1).map((e) => e.url);
      return [rootUrl, ...topN].slice(0, maxPages);
    }

    case "representative_sample": {
      if (!fetchAndParse) {
        throw new Error("fetchAndParse is required for representative_sample mode");
      }
      const entries = sitemapXml ? parseSitemap(sitemapXml) : [];
      const sitemapUrls = entries.map((e) => e.url);
      const bfsUrls = await bfsCrawl(rootUrl, maxPages, maxDepth, fetchAndParse);
      return mergeSitemapAndBfs(sitemapUrls, bfsUrls, maxPages);
    }

    case "full_bounded": {
      if (!fetchAndParse) {
        throw new Error("fetchAndParse is required for full_bounded mode");
      }
      return bfsCrawl(rootUrl, maxPages, maxDepth, fetchAndParse);
    }

    default: {
      // Exhaustive check
      const _exhaustive: never = samplingMode;
      throw new Error(`Unknown sampling mode: ${String(_exhaustive)}`);
    }
  }
}
