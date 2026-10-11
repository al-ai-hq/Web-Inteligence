import type { Pool } from "pg";
import type { EntityConflict } from "../entity-conflict.js";
import type { Lineage } from "../common.js";

interface CreateConflictInput {
  fact_sheet_id: string;
  fact_key: string;
  confirmed_value: unknown | null;
  conflicting_value: unknown;
  source_type: "nap_inconsistency" | "extractor_disagreement" | "connector_conflict";
  source_id?: string;
  severity: "low" | "medium" | "high" | "critical";
}

export class EntityConflictStore {
  constructor(private pool: Pool) {}

  async create(input: CreateConflictInput, lineage: Lineage): Promise<EntityConflict> {
    const result = await this.pool.query(
      `INSERT INTO entity_conflicts (
        fact_sheet_id, fact_key, confirmed_value, conflicting_value,
        source_type, source_id, severity, status, lineage
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8)
      RETURNING *`,
      [
        input.fact_sheet_id,
        input.fact_key,
        input.confirmed_value !== null ? JSON.stringify(input.confirmed_value) : null,
        JSON.stringify(input.conflicting_value),
        input.source_type,
        input.source_id ?? null,
        input.severity,
        JSON.stringify(lineage),
      ],
    );
    return this.rowToEntityConflict(result.rows[0]!);
  }

  async getById(id: string): Promise<EntityConflict | null> {
    const result = await this.pool.query("SELECT * FROM entity_conflicts WHERE id = $1", [id]);
    if (result.rows.length === 0) return null;
    return this.rowToEntityConflict(result.rows[0]!);
  }

  async listByFactSheet(factSheetId: string): Promise<EntityConflict[]> {
    const result = await this.pool.query(
      "SELECT * FROM entity_conflicts WHERE fact_sheet_id = $1 ORDER BY severity DESC, created_at DESC",
      [factSheetId],
    );
    return result.rows.map((row) => this.rowToEntityConflict(row));
  }

  async resolve(
    id: string,
    confirmedValue: unknown,
    resolvedBy: string,
    resolutionNote: string,
  ): Promise<EntityConflict> {
    const result = await this.pool.query(
      `UPDATE entity_conflicts
       SET status = 'resolved', confirmed_value = $2, resolved_by = $3, resolved_at = now(), resolution_note = $4, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, JSON.stringify(confirmedValue), resolvedBy, resolutionNote],
    );
    return this.rowToEntityConflict(result.rows[0]!);
  }

  async dismiss(id: string, resolvedBy: string, resolutionNote: string): Promise<EntityConflict> {
    const result = await this.pool.query(
      `UPDATE entity_conflicts
       SET status = 'dismissed', resolved_by = $2, resolved_at = now(), resolution_note = $3, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, resolvedBy, resolutionNote],
    );
    return this.rowToEntityConflict(result.rows[0]!);
  }

  private rowToEntityConflict(row: Record<string, unknown>): EntityConflict {
    return {
      id: row["id"] as string,
      fact_sheet_id: row["fact_sheet_id"] as string,
      fact_key: row["fact_key"] as string,
      confirmed_value: row["confirmed_value"] ?? null,
      conflicting_value: row["conflicting_value"],
      source_type: row["source_type"] as "nap_inconsistency" | "extractor_disagreement" | "connector_conflict",
      source_id: row["source_id"] as string | null,
      severity: row["severity"] as "low" | "medium" | "high" | "critical",
      status: row["status"] as "open" | "owner_confirmed_value" | "correction_requested" | "resolved" | "dismissed",
      resolved_by: row["resolved_by"] as string | null,
      resolved_at: row["resolved_at"] ? (row["resolved_at"] as Date).toISOString() : null,
      resolution_note: row["resolution_note"] as string | null,
      lineage: row["lineage"] as Lineage,
      created_at: (row["created_at"] as Date).toISOString(),
      updated_at: (row["updated_at"] as Date).toISOString(),
    };
  }
}
