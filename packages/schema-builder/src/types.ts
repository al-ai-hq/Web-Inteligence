import { z } from 'zod';

export const SchemaResultSchema = z.object({
  json_ld: z.record(z.unknown()),
  html_snippet: z.string(),
  validation_errors: z.array(z.string()),
});

export type SchemaResult = z.infer<typeof SchemaResultSchema>;

export const SchemaDiffSchema = z.object({
  added: z.array(z.string()),
  removed: z.array(z.string()),
  changed: z.array(z.object({
    path: z.string(),
    old_value: z.unknown(),
    new_value: z.unknown(),
  })),
});

export type SchemaDiff = z.infer<typeof SchemaDiffSchema>;

export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.object({ path: z.string(), message: z.string() })),
  warnings: z.array(z.object({ path: z.string(), message: z.string() })),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;
