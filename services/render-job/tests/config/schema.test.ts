import { describe, it, expect } from "vitest";
import { renderConfigSchema } from "../../src/config/schema.js";

describe("renderConfigSchema", () => {
  it("accepts valid config", () => {
    const config = {
      per_page_timeout_seconds: 30,
      total_job_timeout_seconds: 300,
      max_response_size_bytes: 10485760,
      max_decompressed_size_bytes: 104857600,
      memory_limit_mb: 512,
      network_idle_timeout_ms: 500,
    };
    const result = renderConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("rejects negative memory_limit_mb", () => {
    const config = {
      per_page_timeout_seconds: 30,
      total_job_timeout_seconds: 300,
      max_response_size_bytes: 10485760,
      max_decompressed_size_bytes: 104857600,
      memory_limit_mb: -1,
      network_idle_timeout_ms: 500,
    };
    const result = renderConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });
});
