import type { Pool } from "pg";
import type { ChangeSet, ChangeSetItem, ApprovalRecord } from "./types.js";

export interface ApprovalStore {
  createChangeSet(changeSet: ChangeSet, items: ChangeSetItem[]): Promise<ChangeSet>;
  findChangeSetById(id: string): Promise<(ChangeSet & { items: ChangeSetItem[] }) | null>;
  findChangeSetsByProjectId(projectId: string): Promise<ChangeSet[]>;
  updateChangeSetStatus(id: string, status: ChangeSet["status"]): Promise<void>;
  createApprovalRecord(record: ApprovalRecord): Promise<ApprovalRecord>;
  findApprovalByChangeSetId(changeSetId: string): Promise<ApprovalRecord | null>;
  updateApprovalStatus(id: string, status: ApprovalRecord["status"]): Promise<void>;
}

export class PostgresApprovalStore implements ApprovalStore {
  constructor(private pool: Pool) {}

  async createChangeSet(changeSet: ChangeSet, items: ChangeSetItem[]): Promise<ChangeSet> {
    await this.pool.query(
      `INSERT INTO change_sets (id, project_id, description, risk_tier, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        changeSet.id,
        changeSet.project_id,
        changeSet.description,
        changeSet.risk_tier,
        changeSet.status,
        changeSet.created_by,
        changeSet.created_at,
        changeSet.updated_at,
      ],
    );
    for (const item of items) {
      await this.pool.query(
        `INSERT INTO change_set_items (id, change_set_id, page_url, field_name, old_value, new_value, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          item.id,
          changeSet.id,
          item.page_url,
          item.field_name,
          item.old_value,
          item.new_value,
          item.created_at,
        ],
      );
    }
    return changeSet;
  }

  async findChangeSetById(id: string): Promise<(ChangeSet & { items: ChangeSetItem[] }) | null> {
    const { rows } = await this.pool.query("SELECT * FROM change_sets WHERE id = $1", [id]);
    if (rows.length === 0) return null;
    const { rows: items } = await this.pool.query(
      "SELECT * FROM change_set_items WHERE change_set_id = $1",
      [id],
    );
    return { ...rows[0], items };
  }

  async findChangeSetsByProjectId(projectId: string): Promise<ChangeSet[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM change_sets WHERE project_id = $1 ORDER BY created_at DESC",
      [projectId],
    );
    return rows;
  }

  async updateChangeSetStatus(id: string, status: ChangeSet["status"]): Promise<void> {
    await this.pool.query("UPDATE change_sets SET status = $1, updated_at = now() WHERE id = $2", [
      status,
      id,
    ]);
  }

  async createApprovalRecord(record: ApprovalRecord): Promise<ApprovalRecord> {
    await this.pool.query(
      `INSERT INTO approval_records (id, change_set_id, risk_tier, approvers, expires_at, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        record.id,
        record.change_set_id,
        record.risk_tier,
        JSON.stringify(record.approvers),
        record.expires_at,
        record.status,
        record.created_at,
        record.updated_at,
      ],
    );
    return record;
  }

  async findApprovalByChangeSetId(changeSetId: string): Promise<ApprovalRecord | null> {
    const { rows } = await this.pool.query(
      "SELECT * FROM approval_records WHERE change_set_id = $1",
      [changeSetId],
    );
    return rows[0] ?? null;
  }

  async updateApprovalStatus(id: string, status: ApprovalRecord["status"]): Promise<void> {
    await this.pool.query(
      "UPDATE approval_records SET status = $1, updated_at = now() WHERE id = $2",
      [status, id],
    );
  }
}
