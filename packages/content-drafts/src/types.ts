import { z } from "zod";

export const ContentDraftSchema = z.object({
  id: z.string().uuid(),
  brief_id: z.string().uuid(),
  project_id: z.string().uuid(),
  status: z.enum(["drafting", "review", "approved", "published"]),
  author: z.string(),
  ai_assisted: z.boolean(),
  ai_disclosure: z.string().nullable(),
  client_input_received: z.boolean(),
  client_input_notes: z.string().nullable(),
  content: z.array(
    z.object({
      language: z.enum(["ar", "en"]),
      title: z.string(),
      meta_description: z.string(),
      body: z.string(),
      headings: z.array(
        z.object({
          level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
          text: z.string(),
        }),
      ),
    }),
  ),
  facts_used: z.array(
    z.object({
      fact_id: z.string(),
      fact_sheet_id: z.string(),
      citation: z.string(),
    }),
  ),
  internal_links: z.array(
    z.object({
      url: z.string(),
      anchor: z.string(),
    }),
  ),
  schema_json_ld: z.unknown().nullable(),
  word_count: z.object({ ar: z.number(), en: z.number() }),
  reading_time_minutes: z.object({ ar: z.number(), en: z.number() }),
  arabic_reviewer: z.string().nullable(),
  arabic_review_date: z.string().nullable(),
  arabic_review_notes: z.string().nullable(),
  cms_draft_url: z.string().nullable(),
  cms_pr_url: z.string().nullable(),
  published_url: z.string().nullable(),
  published_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  last_updated_content_at: z.string(),
});

export type ContentDraft = z.infer<typeof ContentDraftSchema>;
