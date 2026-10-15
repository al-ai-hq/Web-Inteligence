import { z } from "zod";
import { LineageSchema, UUIDSchema } from "./common.js";

export const EntityConflictSchema = z.object({
  id: UUIDSchema,
  fact_sheet_id: UUIDSchema,
  fact_key: z.string().min(1),
  confirmed_value: z.unknown().nullable(),
  conflicting_value: z.unknown(),
  source_type: z.enum(["nap_inconsistency", "extractor_disagreement", "connector_conflict"]),
  source_id: z.string().nullable(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum([
    "open",
    "owner_confirmed_value",
    "correction_requested",
    "resolved",
    "dismissed",
  ]),
  resolved_by: z.string().nullable(),
  resolved_at: z.string().datetime().nullable(),
  resolution_note: z.string().nullable(),
  lineage: LineageSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type EntityConflict = z.infer<typeof EntityConflictSchema>;
