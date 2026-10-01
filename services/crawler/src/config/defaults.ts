import type { CrawlConfig } from "./schema.js";

export const DEFAULT_CRAWL_CONFIG: CrawlConfig = {
  max_pages: 20,
  max_depth: 3,
  timeout_seconds: 900,
  request_timeout_seconds: 30,
  concurrency: 5,
  render_text_threshold_bytes: 500,
  allowed_ports: [80, 443],
  max_response_size_bytes: 10485760,
  max_decompressed_size_bytes: 104857600,
};
