/**
 * Performance, security, and delivery quality evaluators —
 * PRF-001..004, SEC-001..003, DEL-001
 *
 * All per-page evaluators (PageEvaluator).
 *
 * Notes:
 * - All rules are deterministic (no assessed rules in this category).
 * - PRF-001 checks HTTPS validity from site security evidence.
 * - PRF-002 checks Core Web Vitals from PSI connector data.
 * - PRF-003 requires Lighthouse asset audit data not in the evidence model → not_applicable.
 * - PRF-004 checks CLS from PSI connector data.
 * - SEC-001 checks for mixed content (HTTP links on HTTPS pages).
 * - SEC-002 requires response header data not in the evidence model → not_applicable.
 * - SEC-003 requires sub-resource load status not in the evidence model → not_applicable.
 * - DEL-001 checks rendered content parity (render success + non-empty main content).
 *
 * Source: config/rules/performance-security.yaml
 */

import type { EvidenceBundle, PageEvidence } from "../evidence.js";
import type { RuleEvaluation, PageEvaluator } from "../types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Web Vitals "good" thresholds (https://web.dev/articles/vitals). */
const LCP_GOOD_MS = 2500;
const FID_GOOD_MS = 100;
const CLS_GOOD = 0.1;

function isHttpsUrl(url: string): boolean {
  return url.toLowerCase().startsWith("https://");
}

function isHttpUrl(url: string): boolean {
  return url.toLowerCase().startsWith("http://");
}

// ─── PRF-001: HTTPS ──────────────────────────────────────────────────────────

export const evalPRF001: PageEvaluator = (page, bundle) => {
  if (bundle.site.security.https_valid) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  return {
    result: "fail",
    evidence_ids: [page.evidence_id],
    rationale: bundle.site.security.cert_error
      ? `HTTPS is not valid: ${bundle.site.security.cert_error}`
      : "HTTPS is not available or not valid for the site",
  };
};

// ─── PRF-002: Response timing ────────────────────────────────────────────────

export const evalPRF002: PageEvaluator = (page, bundle) => {
  const psi = bundle.connectors.psi;
  if (!psi) {
    return {
      result: "not_applicable",
      evidence_ids: [page.evidence_id],
      rationale: "No PageSpeed Insights data available for response timing evaluation",
    };
  }

  const lcpOk = psi.lcp <= LCP_GOOD_MS;
  const fidOk = psi.fid <= FID_GOOD_MS;
  const clsOk = psi.cls <= CLS_GOOD;

  if (lcpOk && fidOk && clsOk) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  const failures: string[] = [];
  if (!lcpOk) failures.push(`LCP ${psi.lcp}ms > ${LCP_GOOD_MS}ms`);
  if (!fidOk) failures.push(`FID ${psi.fid}ms > ${FID_GOOD_MS}ms`);
  if (!clsOk) failures.push(`CLS ${psi.cls} > ${CLS_GOOD}`);

  return {
    result: "fail",
    evidence_ids: [page.evidence_id],
    rationale: `Core Web Vitals exceed thresholds: ${failures.join(", ")}`,
  };
};

// ─── PRF-003: Asset efficiency ───────────────────────────────────────────────

export const evalPRF003: PageEvaluator = (page, _bundle) => {
  return {
    result: "not_applicable",
    evidence_ids: [page.evidence_id],
    rationale:
      "Asset efficiency requires Lighthouse resource audit data (image/script/stylesheet waste) not available in the current evidence model",
  };
};

// ─── PRF-004: Layout stability sample ────────────────────────────────────────

export const evalPRF004: PageEvaluator = (page, bundle) => {
  const psi = bundle.connectors.psi;
  if (!psi) {
    return {
      result: "not_applicable",
      evidence_ids: [page.evidence_id],
      rationale: "No PageSpeed Insights data available for layout stability evaluation",
    };
  }

  if (psi.cls <= CLS_GOOD) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  return {
    result: "fail",
    evidence_ids: [page.evidence_id],
    rationale: `CLS ${psi.cls} exceeds threshold of ${CLS_GOOD}`,
  };
};

// ─── SEC-001: Mixed content ──────────────────────────────────────────────────

export const evalSEC001: PageEvaluator = (page, _bundle) => {
  // Only applicable to HTTPS pages
  if (!isHttpsUrl(page.url) && !isHttpsUrl(page.final_url)) {
    return {
      result: "not_applicable",
      evidence_ids: [page.evidence_id],
      rationale: "Mixed content check only applies to HTTPS pages",
    };
  }

  // Check for active mixed content: HTTP links on an HTTPS page
  const httpLinks = page.links.filter((l) => isHttpUrl(l.href));

  if (httpLinks.length === 0) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  return {
    result: "fail",
    evidence_ids: [page.evidence_id],
    rationale: `Found ${httpLinks.length} HTTP resource(s) on HTTPS page (mixed content)`,
  };
};

// ─── SEC-002: Security headers ───────────────────────────────────────────────

export const evalSEC002: PageEvaluator = (page, _bundle) => {
  return {
    result: "not_applicable",
    evidence_ids: [page.evidence_id],
    rationale:
      "Security headers evaluation requires HTTP response header data not captured in the current evidence model",
  };
};

// ─── SEC-003: Broken resource load ───────────────────────────────────────────

export const evalSEC003: PageEvaluator = (page, _bundle) => {
  return {
    result: "not_applicable",
    evidence_ids: [page.evidence_id],
    rationale:
      "Broken resource load detection requires sub-resource load status data not captured in the current evidence model",
  };
};

// ─── DEL-001: Rendered content parity ────────────────────────────────────────

export const evalDEL001: PageEvaluator = (page, _bundle) => {
  const renderFailed = !page.render.rendered;
  const emptyContent = page.main_content_bytes <= 0;

  if (renderFailed || emptyContent) {
    const reasons: string[] = [];
    if (renderFailed) {
      reasons.push(
        `Page rendering failed${page.render.render_reason ? `: ${page.render.render_reason}` : ""}`,
      );
    }
    if (emptyContent) {
      reasons.push("Main content is empty (0 bytes)");
    }

    return {
      result: "fail",
      evidence_ids: [page.evidence_id],
      rationale: reasons.join("; "),
      cap_trigger: true,
    };
  }

  return { result: "pass", evidence_ids: [page.evidence_id] };
};
