import type { Pool } from 'pg';
import type { ContentBrief } from './types.js';
import { ContentBriefSchema } from './types.js';

const ALLOWED_COLUMNS = new Set([
  'id', 'project_id', 'audit_id', 'status', 'opportunity_type', 'opportunity_ref',
  'page_goal', 'audience', 'target_action', 'target_url', 'proposed_slug',
  'primary_keyword', 'keyword_variants', 'intent', 'market', 'volume', 'volume_source',
  'position', 'position_source', 'observations', 'recommended_angle', 'outlines',
  'questions', 'entities', 'terms', 'titles', 'meta_descriptions', 'fact_sheet_ids',
  'inputs_needed', 'internal_links', 'schema_types', 'length_guidance', 'cta',
  'conversion_notes', 'regulated_topic', 'success_measures', 'review_date',
  'created_by', 'approved_by', 'approved_at', 'created_at', 'updated_at',
]);

export interface BriefStore {
  create(brief: Omit<ContentBrief, 'id' | 'created_at' | 'updated_at'>): Promise<ContentBrief>;
  getById(id: string): Promise<ContentBrief | null>;
  update(id: string, updates: Partial<ContentBrief>): Promise<ContentBrief>;
  listByProject(projectId: string): Promise<ContentBrief[]>;
}

export class PostgresBriefStore implements BriefStore {
  constructor(private pool: Pool) {}

  async create(brief: Omit<ContentBrief, 'id' | 'created_at' | 'updated_at'>): Promise<ContentBrief> {
    const now = new Date().toISOString();
    const result = await this.pool.query(
      `INSERT INTO content_briefs (
        project_id, audit_id, status, opportunity_type, opportunity_ref,
        page_goal, audience, target_action, target_url, proposed_slug,
        primary_keyword, keyword_variants, intent, market, volume, volume_source,
        position, position_source, observations, recommended_angle, outlines,
        questions, entities, terms, titles, meta_descriptions, fact_sheet_ids,
        inputs_needed, internal_links, schema_types, length_guidance, cta,
        conversion_notes, regulated_topic, success_measures, review_date,
        created_by, approved_by, approved_at, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41)
      RETURNING *`,
      [
        brief.project_id, brief.audit_id, brief.status, brief.opportunity_type, brief.opportunity_ref,
        brief.page_goal, brief.audience, brief.target_action, brief.target_url, brief.proposed_slug,
        brief.primary_keyword, JSON.stringify(brief.keyword_variants), brief.intent, brief.market,
        brief.volume, brief.volume_source, brief.position, brief.position_source,
        JSON.stringify(brief.observations), brief.recommended_angle, JSON.stringify(brief.outlines),
        JSON.stringify(brief.questions), JSON.stringify(brief.entities), JSON.stringify(brief.terms),
        JSON.stringify(brief.titles), JSON.stringify(brief.meta_descriptions),
        JSON.stringify(brief.fact_sheet_ids), JSON.stringify(brief.inputs_needed),
        JSON.stringify(brief.internal_links), JSON.stringify(brief.schema_types),
        JSON.stringify(brief.length_guidance), brief.cta, brief.conversion_notes,
        brief.regulated_topic, JSON.stringify(brief.success_measures), brief.review_date,
        brief.created_by, brief.approved_by, brief.approved_at, now, now,
      ]
    );
    return ContentBriefSchema.parse(result.rows[0]);
  }

  async getById(id: string): Promise<ContentBrief | null> {
    const result = await this.pool.query('SELECT * FROM content_briefs WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return ContentBriefSchema.parse(result.rows[0]);
  }

  async update(id: string, updates: Partial<ContentBrief>): Promise<ContentBrief> {
    for (const key of Object.keys(updates)) {
      if (!ALLOWED_COLUMNS.has(key)) {
        throw new Error(`Invalid column: ${key}`);
      }
    }
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(updates)) {
      sets.push(`${key} = $${idx}`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
      idx++;
    }
    sets.push(`updated_at = $${idx}`);
    values.push(new Date().toISOString());
    values.push(id);
    const result = await this.pool.query(
      `UPDATE content_briefs SET ${sets.join(', ')} WHERE id = $${idx + 1} RETURNING *`,
      values
    );
    return ContentBriefSchema.parse(result.rows[0]);
  }

  async listByProject(projectId: string): Promise<ContentBrief[]> {
    const result = await this.pool.query(
      'SELECT * FROM content_briefs WHERE project_id = $1 ORDER BY created_at DESC',
      [projectId]
    );
    return result.rows.map(r => ContentBriefSchema.parse(r));
  }
}
