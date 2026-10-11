import { z } from "zod";
import { LineageSchema, UUIDSchema } from "./common.js";

export const ProfileObservationSchema = z.object({
  id: UUIDSchema,
  fact_sheet_id: UUIDSchema,
  source_url: z.string().url(),
  extracted_name: z.string().nullable(),
  extracted_phone: z.string().nullable(),
  extracted_email: z.string().email().nullable(),
  extracted_address: z.record(z.string(), z.string()).nullable(),
  extracted_hours: z.record(z.string(), z.string()).nullable(),
  extracted_social: z.record(z.string(), z.string()).nullable(),
  extraction_confidence: z.number().min(0).max(1),
  lineage: LineageSchema,
  created_at: z.string().datetime(),
});

export const PublicSourceObservationSchema = z.object({
  id: UUIDSchema,
  fact_sheet_id: UUIDSchema,
  source_platform: z.string().min(1),
  source_url: z.string().url(),
  discovered_at: z.string().datetime(),
  profile_data: z.record(z.string(), z.unknown()),
  lineage: LineageSchema,
  created_at: z.string().datetime(),
});

export const NapObservationSchema = z.object({
  id: UUIDSchema,
  fact_sheet_id: UUIDSchema,
  source_url: z.string().url(),
  name_value: z.string().nullable(),
  phone_value: z.string().nullable(),
  address_value: z.record(z.string(), z.string()).nullable(),
  consistency_score: z.number().min(0).max(1),
  inconsistencies: z.array(z.object({
    field: z.string(),
    expected: z.string(),
    actual: z.string(),
  })),
  lineage: LineageSchema,
  created_at: z.string().datetime(),
});

export type ProfileObservation = z.infer<typeof ProfileObservationSchema>;
export type PublicSourceObservation = z.infer<typeof PublicSourceObservationSchema>;
export type NapObservation = z.infer<typeof NapObservationSchema>;
