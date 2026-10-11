import { z } from "zod";
import { LineageSchema, UUIDSchema } from "./common.js";

export const FactRegisterEntrySchema = z.object({
  id: UUIDSchema,
  fact_sheet_id: UUIDSchema,
  fact_key: z.string().min(1),
  fact_value: z.unknown(),
  source_type: z.enum(["manual", "extracted", "connector"]),
  source_id: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  lineage: LineageSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type FactRegisterEntry = z.infer<typeof FactRegisterEntrySchema>;
