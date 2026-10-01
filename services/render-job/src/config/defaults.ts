import type { RenderConfig } from "./schema.js";

export const DEFAULT_RENDER_CONFIG: RenderConfig = {
  per_page_timeout_seconds: 30,
  total_job_timeout_seconds: 300,
  max_response_size_bytes: 10485760,
  max_decompressed_size_bytes: 104857600,
  memory_limit_mb: 512,
  network_idle_timeout_ms: 500,
};
