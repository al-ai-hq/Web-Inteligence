import { z } from "zod";

export const LocationSchema = z.object({
  address_line1: z.string().nullable(),
  address_line2: z.string().nullable(),
  address_locality: z.string().nullable(),
  address_region: z.string().nullable(),
  address_postal_code: z.string().nullable(),
  address_country: z.string().nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
});

export type Location = z.infer<typeof LocationSchema>;
