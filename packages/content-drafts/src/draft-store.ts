import type { Pool } from 'pg';
import type { ContentDraft } from './types.js';
import { ContentDraftSchema } from './types.js';

const ALLOWED_COLUMNS = new Set([
  'id', 'brief_id', 'project_id', 'status', 'author', 'ai_assisted', 'ai_disclosure',
  'client_input_received', 'client_input_notes', 'content', 'facts_used',
  'internal_links', 'schema_json_ld', 'word_count', 'reading_time_minutes',
  'arabic_reviewer', 'arabic_review_date', 'arabic_review_notes',
  'cms_draft_url', 'cms_pr_url', 'published_url', 'published_at',
  'created_at', 'updated_at', 'last_updated_content_at',
]);

export interface DraftStore {
  create(draft: ContentDraft): Promise<ContentDraft>;
  findById(id: string): Promise<ContentDraft | null>;
  findByBriefId(briefId: string): Promise<ContentDraft[]>;
  findByProjectId(projectId: string): Promise<ContentDraft[]>;
  update(id: string, updates: Partial<ContentDraft>): Promise<ContentDraft>;
  delete(id: string): Promise<void>;
}

export class PostgresDraftStore implements DraftStore {
  constructor(private pool: Pool) {}

  async create(draft: ContentDraft): Promise<ContentDraft> {
    const result = await this.pool.query(
      `INSERT INTO content_drafts (
        id, brief_id, project_id, status, author, ai_assisted, ai_disclosure,
        client_input_received, client_input_notes, content, facts_used,
        internal_links, schema_json_ld, word_count, reading_time_minutes,
        arabic_reviewer, arabic_review_date, arabic_review_notes,
        cms_draft_url, cms_pr_url, published_url, published_at,
        created_at, updated_at, last_updated_content_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
      RETURNING *`,
      [
        draft.id, draft.brief_id, draft.project_id, draft.status, draft.author,
        draft.ai_assisted, draft.ai_disclosure, draft.client_input_received,
        draft.client_input_notes, JSON.stringify(draft.content),
        JSON.stringify(draft.facts_used), JSON.stringify(draft.internal_links),
        draft.schema_json_ld ? JSON.stringify(draft.schema_json_ld) : null,
        JSON.stringify(draft.word_count), JSON.stringify(draft.reading_time_minutes),
        draft.arabic_reviewer, draft.arabic_review_date, draft.arabic_review_notes,
        draft.cms_draft_url, draft.cms_pr_url, draft.published_url, draft.published_at,
        draft.created_at, draft.updated_at, draft.last_updated_content_at,
      ]
    );
    return ContentDraftSchema.parse(result.rows[0]);
  }

  async findById(id: string): Promise<ContentDraft | null> {
    const result = await this.pool.query('SELECT * FROM content_drafts WHERE id = $1', [id]);
    return result.rows[0] ? ContentDraftSchema.parse(result.rows[0]) : null;
  }

  async findByBriefId(briefId: string): Promise<ContentDraft[]> {
    const result = await this.pool.query('SELECT * FROM content_drafts WHERE brief_id = $1 ORDER BY created_at DESC', [briefId]);
    return result.rows.map(r => ContentDraftSchema.parse(r));
  }

  async findByProjectId(projectId: string): Promise<ContentDraft[]> {
    const result = await this.pool.query('SELECT * FROM content_drafts WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
    return result.rows.map(r => ContentDraftSchema.parse(r));
  }

  async update(id: string, updates: Partial<ContentDraft>): Promise<ContentDraft> {
    for (const key of Object.keys(updates)) {
      if (!ALLOWED_COLUMNS.has(key)) {
        throw new Error(`Invalid column: ${key}`);
      }
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'id') continue;
      const jsonFields = ['content', 'facts_used', 'internal_links', 'schema_json_ld', 'word_count', 'reading_time_minutes'];
      if (jsonFields.includes(key)) {
        fields.push(`${key} = $${paramIndex++}`);
        values.push(value !== null && value !== undefined ? JSON.stringify(value) : null);
      } else {
        fields.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }

    fields.push(`updated_at = $${paramIndex++}`);
    values.push(new Date().toISOString());
    values.push(id);

    const result = await this.pool.query(
      `UPDATE content_drafts SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return ContentDraftSchema.parse(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM content_drafts WHERE id = $1', [id]);
  }
}
