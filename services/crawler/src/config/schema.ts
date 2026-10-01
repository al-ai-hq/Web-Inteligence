import { z } from "zod";

export const crawlConfigSchema = z.object({
  max_pages: z.number().int().positive(),
  max_depth: z.number().int().positive(),
  timeout_seconds: z.number().int().positive(),
  request_timeout_seconds: z.number().int().positive(),
  concurrency: z.number().int().positive(),
  render_text_threshold_bytes: z.number().int().nonnegative(),
  allowed_ports: z.array(z.number().int().refine((p) => p === 80 || p === 443)),
  max_response_size_bytes: z.number().int().positive(),
  max_decompressed_size_bytes: z.number().int().positive(),
});

export type CrawlConfig = z.infer<typeof crawlConfigSchema>;
