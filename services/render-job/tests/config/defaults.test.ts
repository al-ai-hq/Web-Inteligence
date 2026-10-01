import { describe, it, expect } from "vitest";
import { DEFAULT_RENDER_CONFIG } from "../../src/config/defaults.js";
import { renderConfigSchema } from "../../src/config/schema.js";

describe("DEFAULT_RENDER_CONFIG", () => {
  it("matches schema", () => {
    const result = renderConfigSchema.safeParse(DEFAULT_RENDER_CONFIG);
    expect(result.success).toBe(true);
  });

  it("has memory_limit_mb = 512", () => {
    expect(DEFAULT_RENDER_CONFIG.memory_limit_mb).toBe(512);
  });
});
