import { z } from "zod";
import { LineageSchema, UUIDSchema } from "./common.js";

export const FactSheetSchema = z.object({
  id: UUIDSchema,
  project_id: UUIDSchema,
  site_url: z.string().url(),
  business_name: z.string().min(1),
  description: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  address_line1: z.string().nullable(),
  address_line2: z.string().nullable().optional(),
  address_locality: z.string().nullable(),
  address_region: z.string().nullable(),
  address_postal_code: z.string().nullable(),
  address_country: z.string().nullable(),
  geo_latitude: z.number().min(-90).max(90).nullable(),
  geo_longitude: z.number().min(-180).max(180).nullable(),
  social_profiles: z.record(z.string(), z.string()),
  brand_terms: z.object({
    preferred_name: z.string().optional(),
    forbidden_terms: z.array(z.string()).optional(),
  }),
  operating_hours: z.record(z.string(), z.string()),
  status: z.enum(["draft", "confirmed", "superseded"]),
  lineage: LineageSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const FactSheetCreateSchema = z.object({
  project_id: UUIDSchema,
  site_url: z.string().url(),
  business_name: z.string().min(1),
  description: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  address_locality: z.string().optional(),
  address_region: z.string().optional(),
  address_postal_code: z.string().optional(),
  address_country: z.string().optional(),
  geo_latitude: z.number().min(-90).max(90).optional(),
  geo_longitude: z.number().min(-180).max(180).optional(),
  social_profiles: z.record(z.string(), z.string()).optional(),
  brand_terms: z.object({
    preferred_name: z.string().optional(),
    forbidden_terms: z.array(z.string()).optional(),
  }).optional(),
  operating_hours: z.record(z.string(), z.string()).optional(),
});

export type FactSheet = z.infer<typeof FactSheetSchema>;
export type FactSheetCreate = z.infer<typeof FactSheetCreateSchema>;
