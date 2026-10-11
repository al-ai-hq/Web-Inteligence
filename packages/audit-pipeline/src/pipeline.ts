import { join } from "node:path";
import type { AuditRecord, AuditStore } from "./audit-store.js";
import { composeSections } from "./composer.js";
import type { TierName, TierScope } from "./eligibility.js";
import { REPO_ROOT } from "./paths.js";
import { buildReportModel, validateReportModel } from "./report-model.js";
import type { ComposerAgentOutcome } from "./report-envelope.js";
import type { ConnectorResult, AuditContext } from "@wpi/connectors";
import type { TokenStore } from "@wpi/oauth";
import type {
  EvidenceBundle,
  LoadedRule,
  PageRuleResult,
  ScoringConfig,
} from "@wpi/rules-engine";
import {
  aggregateToSite,
  calculatePriority,
  calculateScore,
  generateFindings,
  RuleCatalog,
} from "@wpi/rules-engine";
import type { RulesEngineOutput } from "./composer.js";

export const BASE_LIMITATION_KEYS = [
  "limitation.external_api_tools_unavailable",
] as const;

export type PipelineOutcome = "completed" | "partial" | "failed" | "stopped";

export class PipelineStoppedError extends Error {
  constructor(auditId: string) {
    super(`Pipeline stopped for audit ${auditId}`);
    this.name = "PipelineStoppedError";
  }
}

export interface PipelineDeps {
  store: AuditStore;
  validateUrl: (url: string) => Promise<{ ok: boolean; reason_key?: string }>;
  crawl: (record: AuditRecord, scope: TierScope) => Promise<void>;
  render: (record: AuditRecord) => Promise<void>;
  processEvidence: (record: AuditRecord) => Promise<string[]>;
  enrichFootprint?: (record: AuditRecord, projectId?: string) => Promise<void>;
  runRulesEngine?: (bundle: EvidenceBundle) => Promise<PageRuleResult[]>;
  loadRulesConfig?: () => { rules: LoadedRule[]; scoring: ScoringConfig; catalog: RuleCatalog };
  runAgents: (
    record: AuditRecord,
    evidenceIds: string[],
    scope: TierScope,
  ) => Promise<ComposerAgentOutcome[]>;
  runConnectors: (
    url: string,
    context: AuditContext,
  ) => Promise<ConnectorResult[]>;
  tierScopes: Record<Exclude<TierName, "refused">, TierScope>;
  tokenStore?: TokenStore;
  userId?: string;
}

async function requireTransition(store: AuditStore, auditId: string, to: string): Promise<void> {
  const result = await store.transition(auditId, to);
  if (result === "terminal") {
    throw new PipelineStoppedError(auditId);
  }
}

export async function runAuditPipeline(
  deps: PipelineDeps,
  auditId: string,
): Promise<PipelineOutcome> {
  try {
    const raw = await deps.store.getRaw(auditId);
    if (raw === null || raw.deleted_at !== null || raw.status !== "QUEUED") {
      throw new PipelineStoppedError(auditId);
    }
    await requireTransition(deps.store, auditId, "VALIDATING");

    const validation = await deps.validateUrl(raw.target_url);
    if (!validation.ok) {
      await deps.store.setFailure(auditId, validation.reason_key ?? "failure.url_invalid");
      return "failed";
    }

    const scope =
      raw.tier === "rich" || raw.tier === "reduced" || raw.tier === "preview"
        ? deps.tierScopes[raw.tier]
        : undefined;
    if (scope === undefined) {
      await deps.store.setFailure(auditId, "failure.tier_refused");
      return "failed";
    }

    await requireTransition(deps.store, auditId, "CRAWLING");
    console.log("[pipeline] starting crawl stage");
    await deps.crawl(raw, scope);
    console.log("[pipeline] crawl stage complete");

    await requireTransition(deps.store, auditId, "EXTRACTING");
    console.log("[pipeline] starting render stage");
    await deps.render(raw);
    console.log("[pipeline] render stage complete");
    console.log("[pipeline] starting processEvidence stage");
    const evidenceIds = await deps.processEvidence(raw);
    console.log("[pipeline] processEvidence stage complete, evidenceIds:", evidenceIds.length);

    // ENRICHING_OPTIONAL stage — non-fatal, runs only when callback is provided
    if (deps.enrichFootprint) {
      await requireTransition(deps.store, auditId, "ENRICHING_OPTIONAL");
      try {
        await deps.enrichFootprint(raw);
      } catch (error) {
        // Enrichment failure is non-fatal — log and continue
        console.warn(`Enrichment failed for audit ${auditId}:`, error);
      }
    }

    // Resolve OAuth token before the AUDITING stage
    let accessToken: string | undefined;
    if (deps.tokenStore && deps.userId) {
      const googleToken = await deps.tokenStore.findByUserAndSite(
        deps.userId,
        "google",
        raw.target_url,
      );
      if (googleToken) {
        try {
          accessToken = await deps.tokenStore.decryptAccessToken(googleToken);
        } catch {
          // Token decryption failed, connectors will run without auth
        }
      }
    }

    await requireTransition(deps.store, auditId, "AUDITING");
    console.log("[pipeline] starting agents and connectors stage");

    // Run deterministic rules engine FIRST (before agents + connectors)
    let pageRuleResults: PageRuleResult[] = [];
    if (deps.runRulesEngine) {
      const bundle: EvidenceBundle = {
        methodology_version: "2.0.0",
        tier: raw.tier as "rich" | "reduced" | "preview",
        locale: raw.locale,
        site: {
          root_url: raw.target_url,
          homepage: null,
          robots: { fetched: false, directives: [] },
          sitemap: { present: false },
          llms_txt: null,
          security: { https_valid: true, hsts: false },
        },
        pages: [],
        connectors: {},
      };
      pageRuleResults = await deps.runRulesEngine(bundle);
    }

    // Process rules engine results if config is available
    let rulesOutput: RulesEngineOutput | undefined;
    if (pageRuleResults.length > 0 && deps.loadRulesConfig) {
      const { rules, scoring, catalog } = deps.loadRulesConfig();
      const siteResults = aggregateToSite(pageRuleResults, {
        methodology_version: "2.0.0",
        tier: raw.tier as "rich" | "reduced" | "preview",
        locale: raw.locale,
        site: {
          root_url: raw.target_url,
          homepage: null,
          robots: { fetched: false, directives: [] },
          sitemap: { present: false },
          llms_txt: null,
          security: { https_valid: true, hsts: false },
        },
        pages: [],
        connectors: {},
      });
      const reFindings = generateFindings(siteResults, rules);
      const priorityItems = calculatePriority(reFindings, rules, {
        confidence_level: "medium",
        pages_checked: evidenceIds.length || 1,
      });
      const scoreResult = calculateScore(siteResults, rules, scoring, {
        pages_inspected: evidenceIds.length,
        critical_stages_completed: ["VALIDATING", "CRAWLING", "EXTRACTING", "AUDITING"],
      });
      rulesOutput = {
        findings: reFindings,
        priority_items: priorityItems,
        score: scoreResult,
        unavailable_categories: scoreResult.unavailable_categories,
      };
    }


    const [outcomes, connectorResults] = await Promise.all([
      deps.runAgents(raw, evidenceIds, scope),
      deps.runConnectors(raw.target_url, {
        locale: raw.locale,
        tier: raw.tier as "free" | "rich" | "reduced" | "preview",
        auth: accessToken ? { google: { accessToken } } : undefined,
      }),
    ]);
    console.log("[pipeline] agents and connectors stage complete");

    await requireTransition(deps.store, auditId, "COMPOSING");
    console.log("[pipeline] starting compose stage");
    const composed = composeSections(outcomes, connectorResults, scope, rulesOutput);
    const limitationsKeys = [
      ...BASE_LIMITATION_KEYS,
      ...(evidenceIds.length > 0 ? ["limitation.sample_not_full_site"] : []),
    ];
    const report = buildReportModel({
      auditId,
      locale: raw.locale,
      secretHash: raw.secret_hash,
      expiresAt: raw.expires_at,
      summaryBullets: composed.summary_bullets,
      findingIds: composed.findings.map((finding) => finding.id),
      limitationsKeys,
      pagesChecked: evidenceIds.length,
      sampled: evidenceIds.length > 0,
      findings: composed.findings,
    });
    validateReportModel(report, join(REPO_ROOT, "schemas"));
    const envelope = {
      report,
      findings: composed.findings,
      unavailable: composed.unavailable,
      action_board: composed.action_board,
      costs: composed.costs,
      score: composed.score,
    };
    const to = composed.findings.length > 0 ? ("READY_COMPLETE" as const) : ("READY_PARTIAL" as const);
    await deps.store.setOutcome(auditId, to, envelope, envelope.costs);
    return to === "READY_COMPLETE" ? "completed" : "partial";
  } catch (error) {
    if (error instanceof PipelineStoppedError) {
      return "stopped";
    }
    console.error("[pipeline] audit failed", error);
    if (error instanceof Error) {
      console.error("[pipeline] error name:", error.name);
      console.error("[pipeline] error message:", error.message);
      console.error("[pipeline] error stack:", error.stack);
      if ("cause" in error) {
        console.error("[pipeline] error cause:", error.cause);
      }
    }
    await deps.store.setFailure(auditId, "failure.pipeline_error").catch(() => undefined);
    return "failed";
  }
}
