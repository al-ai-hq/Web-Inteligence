import { randomUUID } from "node:crypto";
import type { Pool, QueryResultRow } from "pg";
import type {
  MarkAppliedInput,
  OutcomeMetric,
  OutcomeStore,
  RecommendationOutcome,
  RecordDeltasInput,
} from "./outcome-store.js";

interface OutcomeRow extends QueryResultRow {
  id: string;
  user_id: string;
  rule_id: string;
  audit_id_applied: string;
  audit_id_measured: string | null;
  metric: string;
  value_before: string | null;
  value_after: string | null;
  as_of_before: Date | null;
  as_of_after: Date | null;
  fidelity_label: string;
  source: string;
  created_at: Date;
  updated_at: Date;
}

/** pg hands NUMERIC back as a string so precision is not lost on the way out. */
function num(value: string | null): number | null {
  // A zero score is a real measurement, so only an absent value maps to null.
  return value === null ? null : Number(value);
}

function rowToOutcome(row: OutcomeRow): RecommendationOutcome {
  return {
    id: row.id,
    user_id: row.user_id,
    rule_id: row.rule_id,
    audit_id_applied: row.audit_id_applied,
    audit_id_measured: row.audit_id_measured,
    metric: row.metric as OutcomeMetric,
    value_before: num(row.value_before),
    value_after: num(row.value_after),
    as_of_before: row.as_of_before?.toISOString() ?? null,
    as_of_after: row.as_of_after?.toISOString() ?? null,
    fidelity_label: row.fidelity_label as RecommendationOutcome["fidelity_label"],
    source: row.source as RecommendationOutcome["source"],
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export class PostgresOutcomeStore implements OutcomeStore {
  constructor(private readonly pool: Pool) {}

  async markApplied(input: MarkAppliedInput): Promise<RecommendationOutcome> {
    const inserted = await this.pool.query<OutcomeRow>(
      `INSERT INTO recommendation_outcomes (id, user_id, rule_id, audit_id_applied, metric)
       VALUES ($1, $2::uuid, $3, $4::uuid, $5)
       ON CONFLICT (user_id, rule_id, audit_id_applied, metric) DO NOTHING
       RETURNING *`,
      [randomUUID(), input.userId, input.ruleId, input.auditIdApplied, input.metric],
    );
    if (inserted.rows[0]) {
      return rowToOutcome(inserted.rows[0]);
    }

    // The row already exists; re-read it rather than failing the user's click.
    const existing = await this.pool.query<OutcomeRow>(
      `SELECT * FROM recommendation_outcomes
       WHERE user_id = $1::uuid AND rule_id = $2 AND audit_id_applied = $3::uuid AND metric = $4`,
      [input.userId, input.ruleId, input.auditIdApplied, input.metric],
    );
    const row = existing.rows[0];
    if (!row) {
      throw new Error(
        `recommendation outcome disappeared between insert and read for user ${input.userId}`,
      );
    }
    return rowToOutcome(row);
  }

  async listPendingForUser(userId: string): Promise<RecommendationOutcome[]> {
    const result = await this.pool.query<OutcomeRow>(
      `SELECT * FROM recommendation_outcomes
       WHERE user_id = $1::uuid AND audit_id_measured IS NULL
       ORDER BY created_at`,
      [userId],
    );
    return result.rows.map(rowToOutcome);
  }

  async recordDeltas(input: RecordDeltasInput): Promise<RecommendationOutcome[]> {
    const measured: RecommendationOutcome[] = [];
    for (const delta of input.deltas) {
      const result = await this.pool.query<OutcomeRow>(
        `UPDATE recommendation_outcomes
         SET audit_id_measured = $2::uuid,
             value_before = $3,
             value_after = $4,
             as_of_before = $5,
             as_of_after = $6,
             updated_at = now()
         WHERE user_id = $1::uuid
           AND rule_id = $7
           AND metric = $8
           AND audit_id_applied = $9::uuid
           AND audit_id_measured IS NULL
         RETURNING *`,
        [
          input.userId,
          input.auditIdMeasured,
          delta.valueBefore,
          delta.valueAfter,
          input.asOfBefore,
          input.asOfAfter,
          delta.ruleId,
          delta.metric,
          delta.auditIdApplied,
        ],
      );
      const row = result.rows[0];
      if (row) {
        measured.push(rowToOutcome(row));
      }
    }
    return measured;
  }

  async listForAudit(auditId: string): Promise<RecommendationOutcome[]> {
    const result = await this.pool.query<OutcomeRow>(
      `SELECT * FROM recommendation_outcomes
       WHERE audit_id_applied = $1::uuid OR audit_id_measured = $1::uuid
       ORDER BY created_at`,
      [auditId],
    );
    return result.rows.map(rowToOutcome);
  }
}
