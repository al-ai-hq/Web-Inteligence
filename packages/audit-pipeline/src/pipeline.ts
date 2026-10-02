import { join } from "node:path";
import type { AuditRecord, AuditStore } from "./audit-store.js";
import { composeSections } from "./composer.js";
import type { TierName, TierScope } from "./eligibility.js";
import { REPO_ROOT } from "./paths.js";
import { buildReportModel, validateReportModel } from "./report-model.js";
import type { ComposerAgentOutcome } from "./report-envelope.js";

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
  runAgents: (
    record: AuditRecord,
    evidenceIds: string[],
    scope: TierScope,
  ) => Promise<ComposerAgentOutcome[]>;
  tierScopes: Record<Exclude<TierName, "refused">, TierScope>;
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

    await requireTransition(deps.store, auditId, "AUDITING");
    const outcomes = await deps.runAgents(raw, evidenceIds, scope);

    await requireTransition(deps.store, auditId, "COMPOSING");
    const composed = composeSections(outcomes, scope);
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
