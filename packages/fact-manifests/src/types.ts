import { z } from "zod";

export const FactManifestFactSchema = z.object({
  id: z.string(),
  fact_manifest_id: z.string(),
  category: z.enum(["product", "service", "pricing", "credential", "result", "review", "policy"]),
  statement: z.string(),
  evidence: z.object({
    source: z.string(),
    retrieved_at: z.string(),
    confidence: z.number().min(0).max(1).optional(),
  }),
  regulated: z.boolean(),
  regulated_topic: z.enum(["health", "finance", "legal"]).nullable(),
  requires_professional_review: z.boolean(),
  expires_at: z.string().nullable(),
  created_at: z.string(),
});

export const FactManifestCitationSchema = z.object({
  id: z.string(),
  fact_id: z.string(),
  draft_id: z.string().nullable(),
  citation_text: z.string(),
  url: z.string().nullable(),
  created_at: z.string(),
});

export const FactManifestSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  fact_sheet_id: z.string(),
  created_by: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  facts: z.array(FactManifestFactSchema),
  citations: z.array(FactManifestCitationSchema),
});

export type FactManifest = z.infer<typeof FactManifestSchema>;
export type FactManifestFact = z.infer<typeof FactManifestFactSchema>;
export type FactManifestCitation = z.infer<typeof FactManifestCitationSchema>;
