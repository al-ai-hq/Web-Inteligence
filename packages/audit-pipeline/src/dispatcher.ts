import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { AuditStore } from "./audit-store.js";
import { deriveActionItems, deriveUnavailable } from "./composer.js";
import { TIER_SCOPES } from "./eligibility.js";
import { REPO_ROOT } from "./paths.js";
import { buildReportModel, validateReportModel } from "./report-model.js";
import type { StoredFinding, StoredReportEnvelope } from "./report-envelope.js";

export interface JobDispatcher {
  dispatch(jobId: string): Promise<void>;
}

export class InProcessDispatcher implements JobDispatcher {
  private chain: Promise<void> = Promise.resolve();

  constructor(private readonly run: (jobId: string) => Promise<void>) {}

  dispatch(jobId: string): Promise<void> {
    const task = this.chain.then(() => this.run(jobId));
    this.chain = task.catch(() => undefined);
    return task;
  }
}

export async function scopedEnv<T>(
  overrides: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const saved = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    saved.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const BASE_KEYS = [
  "limitation.score_engine_deferred",
  "limitation.deterministic_rules_deferred",
  "limitation.external_api_tools_unavailable",
];

function stubFinding(
  agent: string,
  section: StoredFinding["section"],
  title: string,
  recommendation: string,
): StoredFinding {
  return {
    id: randomUUID(),
    agent,
    section,
    severity: "high",
    state: "verified",
    confidence: "high",
    evidence_ids: [],
    data: { title, recommendation, severity: "high" },
  };
}

export class StubDispatcher implements JobDispatcher {
  constructor(
    private readonly store: AuditStore,
    private readonly delayMs = 150,
  ) {}

  async dispatch(jobId: string): Promise<void> {
    try {
      await this.advance(jobId);
    } catch (error) {
      console.error(`[stub-dispatcher] audit ${jobId} failed`, error);
      await this.store.setFailure(jobId, "failure.pipeline_error").catch(() => undefined);
    }
  }

  private async advance(jobId: string): Promise<void> {
    const initial = await this.store.getRaw(jobId);
    if (initial === null || initial.deleted_at !== null) {
      return;
    }
    for (const status of ["VALIDATING", "CRAWLING", "EXTRACTING", "AUDITING", "COMPOSING"]) {
      await sleep(this.delayMs);
      const result = await this.store.transition(jobId, status);
      if (result === "terminal") {
        return;
      }
    }
    await sleep(this.delayMs);
    const record = await this.store.getRaw(jobId);
    if (record === null || record.deleted_at !== null) {
      return;
    }
    const scope =
      record.tier === "rich" || record.tier === "reduced" || record.tier === "preview"
        ? TIER_SCOPES[record.tier]
        : TIER_SCOPES.preview;
    const findings: StoredFinding[] = [
      stubFinding(
        "auditor",
        "technical",
        "Missing meta description on key pages",
        "Add unique meta descriptions to all sampled pages.",
      ),
      stubFinding(
        "content-strategist",
        "content",
        "Thin content on service pages",
        "Expand service pages with 300+ words of original content.",
      ),
    ];
    const report = buildReportModel({
      auditId: jobId,
      locale: record.locale,
      secretHash: record.secret_hash,
      expiresAt: record.expires_at,
      summaryBullets: ["report.summary.technical", "report.summary.content"],
      findingIds: findings.map((finding) => finding.id),
      limitationsKeys: [...BASE_KEYS],
      pagesChecked: 1,
      sampled: false,
      findings,
    });
    validateReportModel(report, join(REPO_ROOT, "schemas"));
    const envelope: StoredReportEnvelope = {
      report,
      findings,
      unavailable: deriveUnavailable(scope),
      action_board: deriveActionItems(findings, scope.actionBoardCap),
      costs: { currency: "USD", agents: [], total_usd: 0 },
    };
    await this.store.setOutcome(jobId, "READY_COMPLETE", envelope, envelope.costs);
  }
}
