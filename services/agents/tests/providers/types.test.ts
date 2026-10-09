import { describe, it, expect } from "vitest";
import type { CompletionRequest } from "../../src/providers/types.js";

describe("CompletionRequest extensions", () => {
  it("accepts webSearch field", () => {
    const req: CompletionRequest = {
      model: "gpt-4o",
      systemPrompt: "test",
      userPrompt: "test",
      webSearch: { enabled: true, maxUses: 2 },
    };
    expect(req.webSearch?.enabled).toBe(true);
    expect(req.webSearch?.maxUses).toBe(2);
  });

  it("accepts location field", () => {
    const req: CompletionRequest = {
      model: "gemini-2.0-flash",
      systemPrompt: "test",
      userPrompt: "test",
      location: { market: "SA", language: "ar" },
    };
    expect(req.location?.market).toBe("SA");
  });

  it("webSearch and location are optional", () => {
    const req: CompletionRequest = {
      model: "gemini-2.0-flash",
      systemPrompt: "test",
      userPrompt: "test",
    };
    expect(req.webSearch).toBeUndefined();
    expect(req.location).toBeUndefined();
  });
});
