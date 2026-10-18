import { randomUUID } from "node:crypto";
import type {
  MarkAppliedInput,
  OutcomeStore,
  RecordDeltasInput,
  RecommendationOutcome,
} from "./outcome-store.js";

function outcomeKey(userId: string, ruleId: string, auditIdApplied: string, metric: string): string {
  return `${userId}:${ruleId}:${auditIdApplied}:${metric}`;
}

/**
 * Synchronous storage exposed through the async `OutcomeStore` contract, so the
 * pipeline and its tests can run without a database.
 */
export class InMemoryOutcomeStore implements OutcomeStore {
  private readonly rows = new Map<string, RecommendationOutcome>();

  private copies(filter: (row: RecommendationOutcome) => boolean): RecommendationOutcome[] {
    return [...this.rows.values()].filter(filter).map((row) => ({ ...row }));
  }

  markApplied(input: MarkAppliedInput): Promise<RecommendationOutcome> {
    const key = outcomeKey(input.userId, input.ruleId, input.auditIdApplied, input.metric);
    const existing = this.rows.get(key);
    if (existing) {
      return Promise.resolve({ ...existing });
    }

    const now = new Date().toISOString();
    const outcome: RecommendationOutcome = {
      id: randomUUID(),
      user_id: input.userId,
      rule_id: input.ruleId,
      audit_id_applied: input.auditIdApplied,
      audit_id_measured: null,
      metric: input.metric,
      value_before: null,
      value_after: null,
      as_of_before: null,
      as_of_after: null,
      fidelity_label: "correlation_only",
      source: "user_marked_applied",
      created_at: now,
      updated_at: now,
    };
    this.rows.set(key, outcome);
    return Promise.resolve({ ...outcome });
  }

  listPendingForUser(userId: string): Promise<RecommendationOutcome[]> {
    return Promise.resolve(
      this.copies((row) => row.user_id === userId && row.audit_id_measured === null),
    );
  }

  recordDeltas(input: RecordDeltasInput): Promise<RecommendationOutcome[]> {
    const updated: RecommendationOutcome[] = [];
    for (const delta of input.deltas) {
      for (const row of this.rows.values()) {
        if (
          row.user_id !== input.userId ||
          row.rule_id !== delta.ruleId ||
          row.metric !== delta.metric ||
          row.audit_id_applied !== delta.auditIdApplied ||
          row.audit_id_measured !== null
        ) {
          continue;
        }
        const next: RecommendationOutcome = {
          ...row,
          audit_id_measured: input.auditIdMeasured,
          value_before: delta.valueBefore,
          value_after: delta.valueAfter,
          as_of_before: input.asOfBefore,
          as_of_after: input.asOfAfter,
          updated_at: new Date().toISOString(),
        };
        this.rows.set(
          outcomeKey(next.user_id, next.rule_id, next.audit_id_applied, next.metric),
          next,
        );
        updated.push({ ...next });
      }
    }
    return Promise.resolve(updated);
  }

  listForAudit(auditId: string): Promise<RecommendationOutcome[]> {
    return Promise.resolve(
      this.copies((row) => row.audit_id_applied === auditId || row.audit_id_measured === auditId),
    );
  }
}
