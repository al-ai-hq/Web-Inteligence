import type { Pool, QueryResultRow } from "pg";
import type {
  AuditContext,
} from "./audit-context.js";
import { isAuditStatus } from "./audit-store.js";
import type {
  AuditRecord,
  AuditStore,
  CreateAuditInput,
  GetActiveResult,
  TransitionResult,
} from "./audit-store.js";
import type { TierName } from "./eligibility.js";
import type { StoredCosts, StoredReportEnvelope } from "./report-envelope.js";
import { canTransition, isTerminal } from "./workflow-states.js";

interface AuditRow extends QueryResultRow {
  id: string;
  target_url: string;
  locale: string;
  tier: string;
  context: unknown;
  status: string;
  failure_reason: string | null;
  secret_hash: string;
  user_id: string | null;
  report: unknown;
  costs: unknown;
  created_at: Date;
  updated_at: Date;
  expires_at: Date | null;
  deleted_at: Date | null;
}

function iso(value: Date): string {
  return value.toISOString();
}

function rowToRecord(row: AuditRow): AuditRecord {
  return {
    id: row.id,
    target_url: row.target_url,
    locale: row.locale as "en" | "ar",
    context: row.context as AuditContext,
    tier: row.tier as TierName,
    status: row.status,
    secret_hash: row.secret_hash,
    user_id: row.user_id,
    failure_reason: row.failure_reason,
    report: (row.report as StoredReportEnvelope | null) ?? null,
    costs: (row.costs as StoredCosts | null) ?? null,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    expires_at: row.expires_at ? iso(row.expires_at) : null,
    deleted_at: row.deleted_at ? iso(row.deleted_at) : null,
  };
}

const GUARD = "status NOT IN ('EXPIRED','CANCELLED') AND deleted_at IS NULL";

export class PostgresAuditStore implements AuditStore {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateAuditInput): Promise<AuditRecord> {
    const result = await this.pool.query<AuditRow>(
      `INSERT INTO audits (target_url, locale, tier, context, status, secret_hash, user_id, expires_at)
       VALUES ($1, $2, $3, $4, 'QUEUED', $5, $6::uuid, CASE WHEN $6::uuid IS NULL THEN now() + make_interval(days => $7) ELSE NULL END)
       RETURNING *`,
      [
        input.targetUrl,
        input.locale,
        input.tier,
        JSON.stringify(input.context),
        input.secretHash,
        input.userId ?? null,
        input.ttlDays,
      ],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error("Audit row missing after INSERT");
    }
    return rowToRecord(row);
  }

  async getRaw(id: string): Promise<AuditRecord | null> {
    const result = await this.pool.query<AuditRow>("SELECT * FROM audits WHERE id = $1", [id]);
    return result.rows[0] ? rowToRecord(result.rows[0]) : null;
  }

  async getActive(id: string): Promise<GetActiveResult> {
    const raw = await this.getRaw(id);
    if (!raw) {
      return "not_found";
    }
    if (raw.deleted_at) {
      return "deleted";
    }
    if (raw.expires_at !== null && new Date(raw.expires_at).getTime() <= Date.now()) {
      await this.transition(id, "EXPIRED").catch(() => undefined);
      return "expired";
    }
    return raw;
  }

  async transition(id: string, to: string): Promise<TransitionResult> {
    const raw = await this.getRaw(id);
    if (!raw) {
      throw new Error(`Audit ${id} not found`);
    }
    if (raw.deleted_at || raw.status === "EXPIRED" || raw.status === "CANCELLED") {
      return "terminal";
    }
    if (!isAuditStatus(raw.status) || !isAuditStatus(to) || !canTransition(raw.status, to)) {
      throw new Error(`Invalid transition ${raw.status} -> ${to}`);
    }
    const result = await this.pool.query<AuditRow>(
      `UPDATE audits SET status = $2, updated_at = now()
       WHERE id = $1 AND ${GUARD}
       RETURNING *`,
      [id, to],
    );
    if (!result.rows[0]) {
      return "terminal";
    }
    return rowToRecord(result.rows[0]);
  }

  async setFailure(
    id: string,
    reasonKey: string,
    costs?: StoredCosts,
  ): Promise<TransitionResult> {
    const raw = await this.getRaw(id);
    if (!raw) {
      throw new Error(`Audit ${id} not found`);
    }
    if (raw.deleted_at || !isAuditStatus(raw.status) || isTerminal(raw.status)) {
      return "terminal";
    }
    const result = await this.pool.query<AuditRow>(
      `UPDATE audits
       SET status = 'FAILED', failure_reason = $2, costs = COALESCE($3, costs), updated_at = now()
       WHERE id = $1 AND ${GUARD}
       RETURNING *`,
      [id, reasonKey, costs ? JSON.stringify(costs) : null],
    );
    if (!result.rows[0]) {
      return "terminal";
    }
    return rowToRecord(result.rows[0]);
  }

  async setOutcome(
    id: string,
    to: "READY_PARTIAL" | "READY_COMPLETE",
    report: StoredReportEnvelope,
    costs: StoredCosts,
  ): Promise<AuditRecord> {
    const raw = await this.getRaw(id);
    if (!raw) {
      throw new Error(`Audit ${id} not found`);
    }
    if (!isAuditStatus(raw.status) || !canTransition(raw.status, to)) {
      throw new Error(`Invalid transition ${raw.status} -> ${to}`);
    }
    const result = await this.pool.query<AuditRow>(
      `UPDATE audits
       SET status = $2, report = $3, costs = $4, updated_at = now()
       WHERE id = $1 AND ${GUARD}
       RETURNING *`,
      [id, to, JSON.stringify(report), JSON.stringify(costs)],
    );
    if (!result.rows[0]) {
      throw new Error(`Audit ${id} could not accept outcome (guarded row missing)`);
    }
    return rowToRecord(result.rows[0]);
  }

  async sweepExpired(now: Date = new Date()): Promise<number> {
    const result = await this.pool.query(
      `UPDATE audits SET status = 'EXPIRED', updated_at = now()
       WHERE deleted_at IS NULL AND status <> 'EXPIRED' AND expires_at <= $1`,
      [now],
    );
    return result.rowCount ?? 0;
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      "UPDATE audits SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL",
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listByUser(userId: string): Promise<AuditRecord[]> {
    const result = await this.pool.query<AuditRow>(
      "SELECT * FROM audits WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC",
      [userId],
    );
    return result.rows.map(rowToRecord);
  }
}
