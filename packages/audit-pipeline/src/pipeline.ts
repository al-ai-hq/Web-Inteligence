import { join } from "node:path";
import type { AuditRecord, AuditStore } from "./audit-store.js";
import { composeSections } from "./composer.js";
import type { TierName, TierScope } from "./eligibility.js";
import { REPO_ROOT } from "./paths.js";
import { buildReportModel, validateReportModel } from "./report-model.js";
import type { ComposerAgentOutcome } from "./report-envelope.js";
import type { ConnectorResult, AuditContext } from "@wpi/connectors";
import type { TokenStore } from "@wpi/oauth";
import type { EvidenceBundle, PageRuleResult } from "@wpi/rules-engine";

export const BASE_LIMITATION_KEYS = [
  "limitation.score_engine_deferred",
  "limitation.deterministic_rules_deferred",
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
  runRulesEngine?: (bundle: EvidenceBundle) => Promise<PageRuleResult[]>;
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
    await deps.crawl(raw, scope);

    await requireTransition(deps.store, auditId, "EXTRACTING");
    await deps.render(raw);
    const evidenceIds = await deps.processEvidence(raw);

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

    // Run deterministic rules engine FIRST (before agents + connectors)
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
      await deps.runRulesEngine(bundle);
    }

    const [outcomes, connectorResults] = await Promise.all([
      deps.runAgents(raw, evidenceIds, scope),
      deps.runConnectors(raw.target_url, {
        locale: raw.locale,
        tier: raw.tier as "free" | "rich" | "reduced" | "preview",
        auth: accessToken ? { google: { accessToken } } : undefined,
      }),
    ]);

    await requireTransition(deps.store, auditId, "COMPOSING");
    const composed = composeSections(outcomes, connectorResults, scope);
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
    };
    const to = composed.findings.length > 0 ? ("READY_COMPLETE" as const) : ("READY_PARTIAL" as const);
    await deps.store.setOutcome(auditId, to, envelope, envelope.costs);
    return to === "READY_COMPLETE" ? "completed" : "partial";
  } catch (error) {
    if (error instanceof PipelineStoppedError) {
      return "stopped";
    }
    await deps.store.setFailure(auditId, "failure.pipeline_error").catch(() => undefined);
    return "failed";
  }
}
