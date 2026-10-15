import { z } from "zod";

export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const auditContextSchema = z
  .object({
    organization: z.string().min(1).max(200),
    business_type: z.string().min(1).max(200),
    offering: z.string().min(1).max(300),
    market: z.string().min(1).max(200),
    customer_language: z.string().min(1).max(50),
    audience: z.string().min(1).max(300),
    competitors: z.string().max(500).optional(),
    target_keywords: z.array(z.string().min(1).max(100)).max(10).optional(),
  })
  .strict();

export type AuditContext = z.infer<typeof auditContextSchema>;

export const createAuditRequestSchema = z
  .object({
    url: z.string().min(1).max(2048),
    locale: z.enum(LOCALES),
    context: auditContextSchema,
  })
  .strict();

export type CreateAuditRequest = z.infer<typeof createAuditRequestSchema>;
