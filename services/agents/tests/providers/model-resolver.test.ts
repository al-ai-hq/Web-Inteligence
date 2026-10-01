import { describe, it, expect } from "vitest";
import { resolveModel } from "../../src/providers/model-resolver.js";

describe("resolveModel", () => {
  it("resolves fast tier to gemini-2.0-flash", () => {
    expect(resolveModel("fast")).toBe("gemini-2.0-flash");
  });

  it("resolves fast_plus_embedding tier to gemini-2.5-flash", () => {
    expect(resolveModel("fast_plus_embedding")).toBe("gemini-2.5-flash");
  });

  it("resolves strong_reasoning tier to gemini-2.5-pro", () => {
    expect(resolveModel("strong_reasoning")).toBe("gemini-2.5-pro");
  });

  it("throws for unknown tier", () => {
    expect(() => resolveModel("unknown_tier")).toThrowError("Unknown model tier: unknown_tier");
  });
});
