import { z } from "zod";

export const UUIDSchema = z.string().uuid();

export const LineageSchema = z.object({
  record_id: UUIDSchema,
  project_id: UUIDSchema.nullable(),
  site_id: UUIDSchema.nullable(),
  source_type: z.enum(["first_party", "third_party_verified", "third_party_unverified"]),
  source_id: z.string(),
  source_version: z.string(),
  captured_at: z.string().datetime(),
  as_of: z.string().datetime(),
  market: z.string().min(2).max(5),
  language: z.string().min(2).max(10),
  device: z.enum(["desktop", "mobile", "tablet", "api"]),
  method: z.string(),
  methodology_version: z.string(),
  fidelity_label: z.enum(["raw", "extracted", "confirmed", "disputed"]),
  content_hash: z.string(),
  parent_ids: z.array(UUIDSchema),
  validation_state: z.enum(["unvalidated", "validated", "invalidated"]),
  audit_id: UUIDSchema.optional(),
});

export type Lineage = z.infer<typeof LineageSchema>;
export type UUID = z.infer<typeof UUIDSchema>;
