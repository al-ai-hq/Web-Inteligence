import type { AuditRecord, AuditStore } from "./audit-store.js";
import { normalizeDomain } from "./site-identity.js";
import type { OutcomeDelta, OutcomeMetric, OutcomeStore } from "./outcome-store.js";

const COMPLETED_STATUSES = new Set<AuditRecord["status"]>(["READY_COMPLETE", "READY_PARTIAL"]);

function metricValue(record: AuditRecord, metric: OutcomeMetric): number | null {
  const result = record.report?.score;
  if (!result) {
    return null;
  }
  if (metric === "presence_readiness") {
    return result.presence_readiness;
  }
  const category = result.categories.find((entry) => entry.category === metric);
  return category?.value ?? null;
}

/**
 * Closes out pending "applied" marks with the values measured by a newly
 * completed audit of the same site.
 *
 * The guard is the spec's minimum-evidence rule: a delta is written only when an
 * earlier completed audit of the same domain exists, the mark predates the audit
 * being measured, and both audits carry a value for that metric. Anything weaker
 * would put a number on the dashboard that is not a comparison.
 *
 * @returns the number of outcome rows measured.
 */
export async function recordOutcomeDeltas(
  outcomes: OutcomeStore,
  audits: AuditStore,
  completedAudit: AuditRecord,
): Promise<number> {
  if (!completedAudit.user_id || !COMPLETED_STATUSES.has(completedAudit.status)) {
    return 0;
  }
  const completedDomain = normalizeDomain(completedAudit.target_url);
  if (!completedDomain) {
    return 0;
  }
  const completedAt = Date.parse(completedAudit.updated_at);
  const pending = await outcomes.listPendingForUser(completedAudit.user_id);
  if (pending.length === 0) {
    return 0;
  }

  const history = await audits.listByUser(completedAudit.user_id);
  // Keyed by baseline audit: the as-of pair belongs to the baseline, and one
  // completed audit can close outcomes that were marked against different sites.
  const byBaseline = new Map<string, { asOfBefore: string; deltas: OutcomeDelta[] }>();

  for (const row of pending) {
    if (Date.parse(row.created_at) > completedAt) {
      continue;
    }
    const applied = await audits.getRaw(row.audit_id_applied);
    if (!applied || normalizeDomain(applied.target_url) !== completedDomain) {
      continue;
    }

    const baseline = history
      .filter(
        (candidate) =>
          candidate.id !== completedAudit.id &&
          COMPLETED_STATUSES.has(candidate.status) &&
          normalizeDomain(candidate.target_url) === completedDomain &&
          Date.parse(candidate.updated_at) < completedAt,
      )
      .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0];
    if (!baseline) {
      continue;
    }

    const valueBefore = metricValue(baseline, row.metric);
    const valueAfter = metricValue(completedAudit, row.metric);
    if (valueBefore === null || valueAfter === null) {
      continue;
    }

    const group = byBaseline.get(baseline.id) ?? { asOfBefore: baseline.updated_at, deltas: [] };
    group.deltas.push({
      ruleId: row.rule_id,
      metric: row.metric,
      auditIdApplied: row.audit_id_applied,
      valueBefore,
      valueAfter,
    });
    byBaseline.set(baseline.id, group);
  }

  let measured = 0;
  for (const group of byBaseline.values()) {
    const rows = await outcomes.recordDeltas({
      userId: completedAudit.user_id,
      auditIdMeasured: completedAudit.id,
      asOfBefore: group.asOfBefore,
      asOfAfter: completedAudit.updated_at,
      deltas: group.deltas,
    });
    measured += rows.length;
  }
  return measured;
}
