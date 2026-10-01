import { describe, it, expect } from "vitest";
import { crawlConfigSchema } from "../../src/config/schema.js";

describe("crawlConfigSchema", () => {
  it("accepts valid config", () => {
    const config = {
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
    const result = crawlConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("rejects negative max_pages", () => {
    const config = {
      max_pages: -1,
      max_depth: 3,
      timeout_seconds: 900,
      request_timeout_seconds: 30,
      concurrency: 5,
      render_text_threshold_bytes: 500,
      allowed_ports: [80, 443],
      max_response_size_bytes: 10485760,
      max_decompressed_size_bytes: 104857600,
    };
    const result = crawlConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("rejects invalid port in allowed_ports", () => {
    const config = {
      max_pages: 20,
      max_depth: 3,
      timeout_seconds: 900,
      request_timeout_seconds: 30,
      concurrency: 5,
      render_text_threshold_bytes: 500,
      allowed_ports: [80, 443, 8080],
      max_response_size_bytes: 10485760,
      max_decompressed_size_bytes: 104857600,
    };
    const result = crawlConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });
});
