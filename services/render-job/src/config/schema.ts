import { z } from "zod";

export const renderConfigSchema = z.object({
  per_page_timeout_seconds: z.number().int().positive(),
  total_job_timeout_seconds: z.number().int().positive(),
  max_response_size_bytes: z.number().int().positive(),
  max_decompressed_size_bytes: z.number().int().positive(),
  memory_limit_mb: z.number().int().positive(),
  network_idle_timeout_ms: z.number().int().nonnegative(),
});

export type RenderConfig = z.infer<typeof renderConfigSchema>;
