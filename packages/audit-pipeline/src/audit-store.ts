import { randomUUID } from "node:crypto";
import type { AuditContext } from "./audit-context.js";
import type { TierName } from "./eligibility.js";
import type { StoredCosts, StoredReportEnvelope } from "./report-envelope.js";
import { AUDIT_STATUSES, canTransition, isTerminal } from "./workflow-states.js";
import type { AuditStatus } from "./workflow-states.js";

const AUDIT_STATUS_STRINGS: readonly string[] = AUDIT_STATUSES;

export function isAuditStatus(value: string): value is AuditStatus {
  return AUDIT_STATUS_STRINGS.includes(value);
}

export interface AuditRecord {
  id: string;
  target_url: string;
  locale: "en" | "ar";
  context: AuditContext;
  tier: TierName;
  status: string;
  secret_hash: string;
  user_id: string | null;
  failure_reason: string | null;
  report: StoredReportEnvelope | null;
  costs: StoredCosts | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  deleted_at: string | null;
}

export interface CreateAuditInput {
  targetUrl: string;
  locale: "en" | "ar";
  context: AuditContext;
  tier: TierName;
  secretHash: string;
  ttlDays: number;
  userId?: string | null;
}

export type GetActiveResult = AuditRecord | "not_found" | "deleted" | "expired";
export type TransitionResult = AuditRecord | "terminal";

export interface AuditStore {
  create(input: CreateAuditInput): Promise<AuditRecord>;
  getActive(id: string): Promise<GetActiveResult>;
  getRaw(id: string): Promise<AuditRecord | null>;
  transition(id: string, to: string): Promise<TransitionResult>;
  setFailure(
    id: string,
    reasonKey: string,
    costs?: StoredCosts,
  ): Promise<TransitionResult>;
  setOutcome(
    id: string,
    to: "READY_PARTIAL" | "READY_COMPLETE",
    report: StoredReportEnvelope,
    costs: StoredCosts,
  ): Promise<AuditRecord>;
  sweepExpired(now?: Date): Promise<number>;
  softDelete(id: string): Promise<boolean>;
  listByUser(userId: string): Promise<AuditRecord[]>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export class InMemoryAuditStore implements AuditStore {
  private readonly rows = new Map<string, AuditRecord>();

  async create(assignment: CreateAuditInput): Promise<AuditRecord> {
    const now = new Date();
    const record: AuditRecord = {
      id: randomUUID(),
      target_url: assignment.targetUrl,
      locale: assignment.locale,
      context: structuredClone(assignment.context),
      tier: assignment.tier,
      status: "QUEUED",
      secret_hash: assignment.secretHash,
      user_id: assignment.userId ?? null,
      failure_reason: null,
      report: null,
      costs: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      expires_at: assignment.userId != null ? null : new Date(now.getTime() + assignment.ttlDays * DAY_MS).toISOString(),
      deleted_at: null,
    };
    this.rows.set(record.id, record);
    return structuredClone(record);
  }

  async getRaw(id: string): Promise<AuditRecord | null> {
    const row = this.rows.get(id);
    return row ? structuredClone(row) : null;
  }

  async getActive(id: string): Promise<GetActiveResult> {
    const row = this.rows.get(id);
    if (!row) {
      return "not_found";
    }
    if (row.deleted_at) {
      return "deleted";
    }
    if (row.expires_at !== null && new Date(row.expires_at).getTime() <= Date.now()) {
      row.status = "EXPIRED";
      row.updated_at = new Date().toISOString();
      return "expired";
    }
    return structuredClone(row);
  }

  async transition(id: string, to: string): Promise<TransitionResult> {
    const row = this.rows.get(id);
    if (!row) {
      throw new Error(`Audit ${id} not found`);
    }
    if (row.deleted_at || row.status === "EXPIRED" || row.status === "CANCELLED") {
      return "terminal";
    }
    if (!isAuditStatus(row.status) || !isAuditStatus(to) || !canTransition(row.status, to)) {
      throw new Error(`Invalid transition ${row.status} -> ${to}`);
    }
    row.status = to;
    row.updated_at = new Date().toISOString();
    return structuredClone(row);
  }

  async setFailure(
    id: string,
    reasonKey: string,
    costs?: StoredCosts,
  ): Promise<TransitionResult> {
    const row = this.rows.get(id);
    if (!row) {
      throw new Error(`Audit ${id} not found`);
    }
    if (row.deleted_at || row.status === "EXPIRED" || row.status === "CANCELLED") {
      return "terminal";
    }
    if (!isAuditStatus(row.status) || isTerminal(row.status)) {
      return "terminal";
    }
    row.status = "FAILED";
    row.failure_reason = reasonKey;
    if (costs) {
      row.costs = structuredClone(costs);
    }
    row.updated_at = new Date().toISOString();
    return structuredClone(row);
  }

  async setOutcome(
    id: string,
    to: "READY_PARTIAL" | "READY_COMPLETE",
    report: StoredReportEnvelope,
    costs: StoredCosts,
  ): Promise<AuditRecord> {
    const row = this.rows.get(id);
    if (!row) {
      throw new Error(`Audit ${id} not found`);
    }
    if (row.deleted_at || row.status === "EXPIRED" || row.status === "CANCELLED") {
      throw new Error(`Audit ${id} is ${row.deleted_at ? "deleted" : row.status}`);
    }
    if (!isAuditStatus(row.status) || !canTransition(row.status, to)) {
      throw new Error(`Invalid transition ${row.status} -> ${to}`);
    }
    row.status = to;
    row.report = structuredClone(report);
    row.costs = structuredClone(costs);
    row.updated_at = new Date().toISOString();
    return structuredClone(row);
  }

  async sweepExpired(now: Date = new Date()): Promise<number> {
    let count = 0;
    for (const row of this.rows.values()) {
      if (
        row.status !== "EXPIRED" &&
        !row.deleted_at &&
        row.expires_at !== null &&
        new Date(row.expires_at).getTime() <= now.getTime()
      ) {
        row.status = "EXPIRED";
        row.updated_at = now.toISOString();
        count += 1;
      }
    }
    return count;
  }

  async softDelete(id: string): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row || row.deleted_at) {
      return false;
    }
    row.deleted_at = new Date().toISOString();
    row.updated_at = row.deleted_at;
    return true;
  }

  async listByUser(userId: string): Promise<AuditRecord[]> {
    const records = [...this.rows.values()]
      .filter((row) => row.user_id === userId && row.deleted_at === null)
      .map((row) => structuredClone(row));
    records.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return records;
  }
}
