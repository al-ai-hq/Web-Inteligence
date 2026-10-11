import type { Pool } from 'pg';
import type { FactManifest, FactManifestFact, FactManifestCitation } from './types.js';

export interface ManifestStore {
  create(manifest: FactManifest): Promise<FactManifest>;
  findById(id: string): Promise<FactManifest | null>;
  findByProjectId(projectId: string): Promise<FactManifest[]>;
  addFact(manifestId: string, fact: FactManifestFact): Promise<void>;
  addCitation(citation: FactManifestCitation): Promise<void>;
}

export class PostgresManifestStore implements ManifestStore {
  constructor(private pool: Pool) {}

  async create(manifest: FactManifest): Promise<FactManifest> {
    await this.pool.query(
      `INSERT INTO fact_manifests (id, project_id, fact_sheet_id, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [manifest.id, manifest.project_id, manifest.fact_sheet_id, manifest.created_by, manifest.created_at, manifest.updated_at]
    );
    for (const fact of manifest.facts) {
      await this.addFact(manifest.id, fact);
    }
    return manifest;
  }

  async findById(id: string): Promise<FactManifest | null> {
    const { rows } = await this.pool.query('SELECT * FROM fact_manifests WHERE id = $1', [id]);
    if (rows.length === 0) return null;
    const { rows: facts } = await this.pool.query('SELECT * FROM fact_manifest_facts WHERE fact_manifest_id = $1', [id]);
    const factIds: string[] = facts.map((f: { id: string }) => f.id);
    const { rows: citations } = factIds.length > 0
      ? await this.pool.query('SELECT * FROM fact_manifest_citations WHERE fact_id = ANY($1)', [factIds])
      : { rows: [] };
    return { ...rows[0], facts, citations };
  }

  async findByProjectId(projectId: string): Promise<FactManifest[]> {
    const { rows } = await this.pool.query('SELECT * FROM fact_manifests WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
    return rows;
  }

  async addFact(manifestId: string, fact: FactManifestFact): Promise<void> {
    await this.pool.query(
      `INSERT INTO fact_manifest_facts (id, fact_manifest_id, category, statement, evidence, regulated, regulated_topic, requires_professional_review, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [fact.id, manifestId, fact.category, fact.statement, JSON.stringify(fact.evidence), fact.regulated, fact.regulated_topic, fact.requires_professional_review, fact.expires_at, fact.created_at]
    );
  }

  async addCitation(citation: FactManifestCitation): Promise<void> {
    await this.pool.query(
      `INSERT INTO fact_manifest_citations (id, fact_id, draft_id, citation_text, url, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [citation.id, citation.fact_id, citation.draft_id, citation.citation_text, citation.url, new Date().toISOString()]
    );
  }
}
