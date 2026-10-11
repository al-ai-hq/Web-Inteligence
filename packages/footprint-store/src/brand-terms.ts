import { z } from "zod";

export const BrandTermsSchema = z.object({
  preferred_name: z.string().optional(),
  forbidden_terms: z.array(z.string()).optional(),
  tagline: z.string().optional(),
});

export type BrandTerms = z.infer<typeof BrandTermsSchema>;
