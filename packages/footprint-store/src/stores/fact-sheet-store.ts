import type { Pool } from "pg";
import type { FactSheet, FactSheetCreate } from "../fact-sheet.js";
import type { Lineage } from "../common.js";

const ALLOWED_FACT_SHEET_COLUMNS = new Set([
  "project_id",
  "business_name",
  "site_url",
  "phone",
  "email",
  "description",
  "address_line1",
  "address_line2",
  "address_locality",
  "address_region",
  "address_postal_code",
  "address_country",
  "geo_latitude",
  "geo_longitude",
  "social_profiles",
  "brand_terms",
  "operating_hours",
  "status",
]);

export class FactSheetStore {
  constructor(private pool: Pool) {}

  async create(input: FactSheetCreate, lineage: Lineage): Promise<FactSheet> {
    const result = await this.pool.query(
      `INSERT INTO fact_sheets (
        project_id, site_url, business_name, description, phone, email,
        address_line1, address_line2, address_locality, address_region,
        address_postal_code, address_country, geo_latitude, geo_longitude,
        social_profiles, brand_terms, operating_hours, status, lineage
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'draft', $18)
      RETURNING *`,
      [
        input.project_id,
        input.site_url,
        input.business_name,
        input.description ?? null,
        input.phone ?? null,
        input.email ?? null,
        input.address_line1 ?? null,
        input.address_line2 ?? null,
        input.address_locality ?? null,
        input.address_region ?? null,
        input.address_postal_code ?? null,
        input.address_country ?? null,
        input.geo_latitude ?? null,
        input.geo_longitude ?? null,
        JSON.stringify(input.social_profiles ?? {}),
        JSON.stringify(input.brand_terms ?? {}),
        JSON.stringify(input.operating_hours ?? {}),
        JSON.stringify(lineage),
      ],
    );
    return this.rowToFactSheet(result.rows[0]!);
  }

  async getById(id: string): Promise<FactSheet | null> {
    const result = await this.pool.query("SELECT * FROM fact_sheets WHERE id = $1", [id]);
    if (result.rows.length === 0) return null;
    return this.rowToFactSheet(result.rows[0]!);
  }

  async listByProject(projectId: string): Promise<FactSheet[]> {
    const result = await this.pool.query(
      "SELECT * FROM fact_sheets WHERE project_id = $1 ORDER BY created_at DESC",
      [projectId],
    );
    return result.rows.map((row) => this.rowToFactSheet(row));
  }

  async update(
    id: string,
    updates: Partial<FactSheetCreate>,
    lineage: Lineage,
  ): Promise<FactSheet> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        if (!ALLOWED_FACT_SHEET_COLUMNS.has(key)) {
          throw new Error(`Invalid fact sheet column: ${key}`);
        }
        fields.push(`${key} = $${paramIndex}`);
        values.push(
          value === null ? null : typeof value === "object" ? JSON.stringify(value) : value,
        );
        paramIndex++;
      }
    }

    fields.push(`updated_at = now()`);
    values.push(id);

    const result = await this.pool.query(
      `UPDATE fact_sheets SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );
    return this.rowToFactSheet(result.rows[0]!);
  }

  async confirm(id: string, confirmedBy: string): Promise<FactSheet> {
    const result = await this.pool.query(
      `UPDATE fact_sheets SET status = 'confirmed', updated_at = now() WHERE id = $1 RETURNING *`,
      [id],
    );
    return this.rowToFactSheet(result.rows[0]!);
  }

  private rowToFactSheet(row: Record<string, unknown>): FactSheet {
    return {
      id: row["id"] as string,
      project_id: row["project_id"] as string,
      site_url: row["site_url"] as string,
      business_name: row["business_name"] as string,
      description: row["description"] as string | null,
      phone: row["phone"] as string | null,
      email: row["email"] as string | null,
      address_line1: row["address_line1"] as string | null,
      address_line2: row["address_line2"] as string | null,
      address_locality: row["address_locality"] as string | null,
      address_region: row["address_region"] as string | null,
      address_postal_code: row["address_postal_code"] as string | null,
      address_country: row["address_country"] as string | null,
      geo_latitude: row["geo_latitude"] as number | null,
      geo_longitude: row["geo_longitude"] as number | null,
      social_profiles: (row["social_profiles"] ?? {}) as Record<string, string>,
      brand_terms: (row["brand_terms"] ?? {}) as {
        preferred_name?: string;
        forbidden_terms?: string[];
      },
      operating_hours: (row["operating_hours"] ?? {}) as Record<string, string>,
      status: row["status"] as "draft" | "confirmed" | "superseded",
      lineage: row["lineage"] as Lineage,
      created_at: (row["created_at"] as Date).toISOString(),
      updated_at: (row["updated_at"] as Date).toISOString(),
    };
  }
}
