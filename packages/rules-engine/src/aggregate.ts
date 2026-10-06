/**
 * Aggregation — page-to-site rollup with ratio policy and template clustering.
 *
 * Implements spec §6.1 (page → site aggregation) and §6.2 (template clustering).
 *
 * §6.1 Ratio policy:
 *   failed_ratio = failed_pages / checked_pages
 *   failed_ratio == 0            → pass
 *   0 < failed_ratio <= 0.49     → partial
 *   failed_ratio >= 0.5          → fail
 *   partial pages count as 0.5 fail-equivalent.
 *   not_applicable pages are removed from the denominator.
 *
 * §6.2 Template clustering:
 *   Normalize path → replace numeric/hex segments with {id}, collapse query strings,
 *   group by first-two path segments + depth.
 *   Clusters with >= 3 pages where the same rule fails on >= 60% of cluster pages
 *   produce a template-scoped RuleResult alongside the site-scope result.
 */

import type { EvidenceBundle, PageEvidence } from "./evidence.js";
import type { PageRuleResult, RuleResult, TemplateCluster } from "./types.js";

// ─── Page → Site Aggregation ──────────────────────────────────────────────────

/**
 * Aggregate per-page RuleResults into site-scope RuleResults.
 *
 * For site-scope rules (page_id === "site"), pass through directly.
 * For page-scope rules, apply the ratio policy to produce one site-scope result.
 */
export function aggregateToSite(results: PageRuleResult[], bundle: EvidenceBundle): RuleResult[] {
  const siteResults: RuleResult[] = [];

  // Group results by rule_id
  const byRule = groupBy(results, (r) => r.rule_id);

  for (const [ruleId, ruleResults] of byRule) {
    // Check if this is a site-scope rule (single result with page_id "site")
    const siteResult = ruleResults.find((r) => r.page_id === "site");
    if (siteResult && ruleResults.length === 1) {
      siteResults.push({
        rule_id: ruleId,
        result: siteResult.result,
        evidence_ids: siteResult.evidence_ids,
        rationale: siteResult.rationale,
        cap_trigger: siteResult.cap_trigger,
        scope: "site",
        affected_urls: [],
      });
      continue;
    }

    // Page-scope rule — apply ratio policy
    const aggregated = aggregatePageResults(ruleId, ruleResults, bundle);
    siteResults.push(aggregated);
  }

  return siteResults;
}

/**
 * Apply the ratio policy for a single page-scope rule.
 *
 * failed_ratio = (fail_count + 0.5 * partial_count) / checked_pages
 * where checked_pages = total pages - not_applicable pages - unavailable pages - error pages
 */
function aggregatePageResults(
  ruleId: string,
  pageResults: PageRuleResult[],
  bundle: EvidenceBundle,
): RuleResult {
  // Build page_id → url map
  const pageUrlMap = new Map<string, string>();
  for (const page of bundle.pages) {
    pageUrlMap.set(page.evidence_id, page.url);
  }

  let failCount = 0;
  let partialCount = 0;
  let passCount = 0;
  let checkedPages = 0;
  const failingUrls: string[] = [];
  const allEvidenceIds: string[] = [];
  let anyCapTrigger = false;

  for (const pr of pageResults) {
    if (pr.result === "not_applicable" || pr.result === "unavailable" || pr.result === "error") {
      // Removed from denominator
      continue;
    }

    checkedPages++;
    allEvidenceIds.push(...pr.evidence_ids);

    if (pr.result === "fail") {
      failCount++;
      const url = pageUrlMap.get(pr.page_id);
      if (url && failingUrls.length < 20) {
        failingUrls.push(url);
      }
      if (pr.cap_trigger) anyCapTrigger = true;
    } else if (pr.result === "partial") {
      partialCount++;
      if (pr.cap_trigger) anyCapTrigger = true;
    } else if (pr.result === "pass") {
      passCount++;
    }
  }

  if (checkedPages === 0) {
    return {
      rule_id: ruleId,
      result: "not_applicable",
      evidence_ids: [],
      scope: "site",
      affected_urls: [],
    };
  }

  // failed_ratio = (fail + 0.5 * partial) / checked
  const failEquivalent = failCount + 0.5 * partialCount;
  const failedRatio = failEquivalent / checkedPages;

  let siteResult: "pass" | "partial" | "fail";
  if (failedRatio === 0) {
    siteResult = "pass";
  } else if (failedRatio < 0.5) {
    siteResult = "partial";
  } else {
    siteResult = "fail";
  }

  // Deduplicate evidence_ids
  const uniqueEvidence = [...new Set(allEvidenceIds)];

  return {
    rule_id: ruleId,
    result: siteResult,
    evidence_ids: uniqueEvidence,
    cap_trigger: anyCapTrigger || undefined,
    scope: "site",
    affected_urls: failingUrls,
    failed_ratio: failedRatio,
  };
}

// ─── Template Clustering ──────────────────────────────────────────────────────

/**
 * Cluster pages by URL pattern.
 *
 * Algorithm:
 * 1. Parse each page URL path
 * 2. Normalize: replace numeric/hex segments with {id}, drop query strings
 * 3. Group by first two path segments + depth (number of segments)
 * 4. Return clusters with their page IDs and URLs
 */
export function clusterPagesByTemplate(pages: PageEvidence[]): TemplateCluster[] {
  const clusterMap = new Map<string, { pageIds: string[]; urls: string[] }>();

  for (const page of pages) {
    const key = computeTemplateKey(page.url);
    if (!clusterMap.has(key)) {
      clusterMap.set(key, { pageIds: [], urls: [] });
    }
    const cluster = clusterMap.get(key)!;
    cluster.pageIds.push(page.evidence_id);
    cluster.urls.push(page.url);
  }

  return Array.from(clusterMap.entries()).map(([key, { pageIds, urls }]) => ({
    cluster_key: key,
    page_ids: pageIds,
    urls,
  }));
}

/**
 * Compute a deterministic template key from a URL.
 *
 * 1. Parse the path from the URL
 * 2. Split into segments
 * 3. Replace numeric or hex-looking segments with {id}
 * 4. Use first two meaningful segments + depth as the key
 */
export function computeTemplateKey(url: string): string {
  let pathname: string;
  try {
    const parsed = new URL(url);
    pathname = parsed.pathname;
  } catch {
    // If URL parsing fails, use the raw string
    pathname = url;
  }

  // Remove trailing slash and split
  const segments = pathname.replace(/\/+$/, "").split("/").filter(Boolean);

  if (segments.length === 0) return "root";

  // Normalize segments: replace numeric/hex with {id}, also trailing -{digits}
  const normalized = segments.map((seg) => {
    if (/^\d+$/.test(seg)) return "{id}";
    if (/^[0-9a-f]{6,}$/i.test(seg)) return "{id}";
    // Replace trailing -{digits} pattern (e.g. post-1 → post-{id})
    const trailingNum = seg.match(/^(.+)-(\d+)$/);
    if (trailingNum) return `${trailingNum[1]}-{id}`;
    return seg;
  });

  // Key = first two segments + depth
  const depth = normalized.length;
  const prefix = normalized.slice(0, Math.min(2, normalized.length)).join("/");
  return `${prefix}:d${depth}`;
}

/**
 * Produce template-scoped RuleResults for clusters where the same rule
 * fails on >= 60% of cluster pages (and cluster has >= 3 pages).
 *
 * These are informational — scoring uses site-scope results exclusively.
 */
export function findTemplateFailures(
  pageResults: PageRuleResult[],
  clusters: TemplateCluster[],
  bundle: EvidenceBundle,
): RuleResult[] {
  const templateResults: RuleResult[] = [];

  // Build page_id → url map
  const pageUrlMap = new Map<string, string>();
  for (const page of bundle.pages) {
    pageUrlMap.set(page.evidence_id, page.url);
  }

  for (const cluster of clusters) {
    // Only consider clusters with >= 3 pages
    if (cluster.page_ids.length < 3) continue;

    const clusterPageSet = new Set(cluster.page_ids);

    // Group page results by rule_id for pages in this cluster
    const ruleResultsInCluster = new Map<string, PageRuleResult[]>();
    for (const pr of pageResults) {
      if (!clusterPageSet.has(pr.page_id)) continue;
      if (!ruleResultsInCluster.has(pr.rule_id)) {
        ruleResultsInCluster.set(pr.rule_id, []);
      }
      ruleResultsInCluster.get(pr.rule_id)!.push(pr);
    }

    for (const [ruleId, results] of ruleResultsInCluster) {
      const failCount = results.filter((r) => r.result === "fail").length;
      const total = results.length;

      if (total >= 3 && failCount / total >= 0.6) {
        const failingUrls = results
          .filter((r) => r.result === "fail")
          .map((r) => pageUrlMap.get(r.page_id))
          .filter((u): u is string => u !== undefined)
          .slice(0, 20);

        const allEvidence = results.flatMap((r) => r.evidence_ids);

        templateResults.push({
          rule_id: ruleId,
          result: "fail",
          evidence_ids: [...new Set(allEvidence)],
          scope: "template",
          affected_urls: failingUrls,
          template_cluster_key: cluster.cluster_key,
          failed_ratio: failCount / total,
        });
      }
    }
  }

  return templateResults;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}
