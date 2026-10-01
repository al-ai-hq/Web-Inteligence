import { describe, it, expect } from "vitest";
import { DEFAULT_CRAWL_CONFIG } from "../../src/config/defaults.js";
import { crawlConfigSchema } from "../../src/config/schema.js";

describe("DEFAULT_CRAWL_CONFIG", () => {
  it("matches schema", () => {
    const result = crawlConfigSchema.safeParse(DEFAULT_CRAWL_CONFIG);
    expect(result.success).toBe(true);
  });

  it("has max_pages = 20", () => {
    expect(DEFAULT_CRAWL_CONFIG.max_pages).toBe(20);
  });

  it("has allowed_ports = [80, 443]", () => {
    expect(DEFAULT_CRAWL_CONFIG.allowed_ports).toEqual([80, 443]);
  });
});
