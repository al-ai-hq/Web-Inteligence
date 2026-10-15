import { z } from "zod";

export const ContentBriefSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  audit_id: z.string().uuid().nullable(),
  status: z.enum(["draft", "approved", "rejected"]),

  opportunity_type: z.enum(["unmapped_cluster", "low_ctr", "visibility_gap", "aeo_failure"]),
  opportunity_ref: z.string(),

  page_goal: z.string(),
  audience: z.string(),
  target_action: z.string(),
  target_url: z.string().url().nullable(),
  proposed_slug: z.string().nullable(),

  primary_keyword: z.string(),
  keyword_variants: z.array(
    z.object({
      keyword: z.string(),
      language: z.enum(["ar", "en"]),
      normalized: z.string().optional(),
    }),
  ),
  intent: z.enum(["informational", "navigational", "commercial", "transactional"]),
  market: z.string(),
  volume: z.number().int().nullable(),
  volume_source: z.string().nullable(),
  position: z.number().nullable(),
  position_source: z.string().nullable(),

  observations: z.array(
    z.object({
      date: z.string(),
      source: z.enum(["serp", "ai_citation", "manual"]),
      urls_examined: z.array(z.string()),
      notes: z.string(),
    }),
  ),
  recommended_angle: z.string(),

  outlines: z.array(
    z.object({
      language: z.enum(["ar", "en"]),
      headings: z.array(
        z.object({
          level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
          text: z.string(),
          notes: z.string().optional(),
        }),
      ),
    }),
  ),

  questions: z.array(
    z.object({
      question: z.string(),
      source: z.enum(["search_console", "upload", "visibility_prompt", "manual"]),
    }),
  ),

  entities: z.array(z.string()),
  terms: z.array(z.string()),

  titles: z.array(
    z.object({
      language: z.enum(["ar", "en"]),
      text: z.string(),
    }),
  ),
  meta_descriptions: z.array(
    z.object({
      language: z.enum(["ar", "en"]),
      text: z.string(),
    }),
  ),

  fact_sheet_ids: z.array(z.string().uuid()),
  inputs_needed: z.array(z.string()),
  internal_links: z.array(
    z.object({
      url: z.string(),
      anchor: z.string(),
      reason: z.string(),
    }),
  ),
  schema_types: z.array(z.string()),

  length_guidance: z.object({
    min_words: z.number().int(),
    max_words: z.number().int(),
    basis: z.string(),
  }),

  cta: z.string(),
  conversion_notes: z.string(),
  regulated_topic: z.enum(["health", "finance", "legal"]).nullable(),

  success_measures: z.array(
    z.object({
      metric: z.enum(["impressions", "clicks", "average_position", "panel_retest"]),
      target: z.string(),
    }),
  ),
  review_date: z.string(),

  created_by: z.string(),
  approved_by: z.string().nullable(),
  approved_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ContentBrief = z.infer<typeof ContentBriefSchema>;
