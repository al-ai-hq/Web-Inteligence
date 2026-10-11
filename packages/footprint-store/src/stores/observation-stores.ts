import type { Pool } from "pg";
import type { PublicSourceObservation, ProfileObservation, NapObservation } from "../observations.js";
import type { Lineage } from "../common.js";

export class PublicSourceObservationStore {
  constructor(private pool: Pool) {}

  async create(
    input: {
      fact_sheet_id: string;
      source_platform: string;
      source_url: string;
      discovered_at: string;
      profile_data: Record<string, unknown>;
    },
    lineage: Lineage,
  ): Promise<PublicSourceObservation> {
    const result = await this.pool.query(
      `INSERT INTO public_source_observations (fact_sheet_id, source_platform, source_url, discovered_at, profile_data, lineage)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [input.fact_sheet_id, input.source_platform, input.source_url, input.discovered_at, JSON.stringify(input.profile_data), JSON.stringify(lineage)],
    );
    return this.rowToObservation(result.rows[0]!);
  }

  async listByFactSheet(factSheetId: string): Promise<PublicSourceObservation[]> {
    const result = await this.pool.query(
      "SELECT * FROM public_source_observations WHERE fact_sheet_id = $1 ORDER BY created_at DESC",
      [factSheetId],
    );
    return result.rows.map((row) => this.rowToObservation(row));
  }

  private rowToObservation(row: Record<string, unknown>): PublicSourceObservation {
    return {
      id: row["id"] as string,
      fact_sheet_id: row["fact_sheet_id"] as string,
      source_platform: row["source_platform"] as string,
      source_url: row["source_url"] as string,
      discovered_at: (row["discovered_at"] as Date).toISOString(),
      profile_data: (row["profile_data"] ?? {}) as Record<string, unknown>,
      lineage: row["lineage"] as Lineage,
      created_at: (row["created_at"] as Date).toISOString(),
    };
  }
}

export class ProfileObservationStore {
  constructor(private pool: Pool) {}

  async create(
    input: {
      fact_sheet_id: string;
      source_url: string;
      extracted_name?: string | null;
      extracted_phone?: string | null;
      extracted_email?: string | null;
      extracted_address?: Record<string, string> | null;
      extracted_hours?: Record<string, string> | null;
      extracted_social?: Record<string, string> | null;
      extraction_confidence: number;
    },
    lineage: Lineage,
  ): Promise<ProfileObservation> {
    const result = await this.pool.query(
      `INSERT INTO profile_observations (
        fact_sheet_id, source_url, extracted_name, extracted_phone, extracted_email,
        extracted_address, extracted_hours, extracted_social, extraction_confidence, lineage
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        input.fact_sheet_id,
        input.source_url,
        input.extracted_name ?? null,
        input.extracted_phone ?? null,
        input.extracted_email ?? null,
        input.extracted_address ? JSON.stringify(input.extracted_address) : null,
        input.extracted_hours ? JSON.stringify(input.extracted_hours) : null,
        input.extracted_social ? JSON.stringify(input.extracted_social) : null,
        input.extraction_confidence,
        JSON.stringify(lineage),
      ],
    );
    return this.rowToObservation(result.rows[0]!);
  }

  async listByFactSheet(factSheetId: string): Promise<ProfileObservation[]> {
    const result = await this.pool.query(
      "SELECT * FROM profile_observations WHERE fact_sheet_id = $1 ORDER BY created_at DESC",
      [factSheetId],
    );
    return result.rows.map((row) => this.rowToObservation(row));
  }

  private rowToObservation(row: Record<string, unknown>): ProfileObservation {
    return {
      id: row["id"] as string,
      fact_sheet_id: row["fact_sheet_id"] as string,
      source_url: row["source_url"] as string,
      extracted_name: row["extracted_name"] as string | null,
      extracted_phone: row["extracted_phone"] as string | null,
      extracted_email: row["extracted_email"] as string | null,
      extracted_address: row["extracted_address"] as Record<string, string> | null,
      extracted_hours: row["extracted_hours"] as Record<string, string> | null,
      extracted_social: row["extracted_social"] as Record<string, string> | null,
      extraction_confidence: row["extraction_confidence"] as number,
      lineage: row["lineage"] as Lineage,
      created_at: (row["created_at"] as Date).toISOString(),
    };
  }
}

export class NapObservationStore {
  constructor(private pool: Pool) {}

  async create(
    input: {
      fact_sheet_id: string;
      source_url: string;
      name_value?: string | null;
      phone_value?: string | null;
      address_value?: Record<string, string> | null;
      consistency_score: number;
      inconsistencies: Array<{ field: string; expected: string; actual: string }>;
    },
    lineage: Lineage,
  ): Promise<NapObservation> {
    const result = await this.pool.query(
      `INSERT INTO nap_observations (fact_sheet_id, source_url, name_value, phone_value, address_value, consistency_score, inconsistencies, lineage)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.fact_sheet_id,
        input.source_url,
        input.name_value ?? null,
        input.phone_value ?? null,
        input.address_value ? JSON.stringify(input.address_value) : null,
        input.consistency_score,
        JSON.stringify(input.inconsistencies),
        JSON.stringify(lineage),
      ],
    );
    return this.rowToObservation(result.rows[0]!);
  }

  async listByFactSheet(factSheetId: string): Promise<NapObservation[]> {
    const result = await this.pool.query(
      "SELECT * FROM nap_observations WHERE fact_sheet_id = $1 ORDER BY consistency_score ASC",
      [factSheetId],
    );
    return result.rows.map((row) => this.rowToObservation(row));
  }

  private rowToObservation(row: Record<string, unknown>): NapObservation {
    return {
      id: row["id"] as string,
      fact_sheet_id: row["fact_sheet_id"] as string,
      source_url: row["source_url"] as string,
      name_value: row["name_value"] as string | null,
      phone_value: row["phone_value"] as string | null,
      address_value: row["address_value"] as Record<string, string> | null,
      consistency_score: row["consistency_score"] as number,
      inconsistencies: (row["inconsistencies"] ?? []) as Array<{ field: string; expected: string; actual: string }>,
      lineage: row["lineage"] as Lineage,
      created_at: (row["created_at"] as Date).toISOString(),
    };
  }
}
