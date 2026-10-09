import { describe, it, expect } from "vitest";
import type { ContentPart, CompletionRequest } from "../../src/providers/types.js";

describe("ContentPart", () => {
  it("accepts text content part", () => {
    const part: ContentPart = { type: "text", text: "Hello" };
    expect(part.type).toBe("text");
    expect(part.text).toBe("Hello");
  });

  it("accepts image content part", () => {
    const part: ContentPart = { type: "image", mimeType: "image/png", data: "base64data" };
    expect(part.type).toBe("image");
    expect(part.mimeType).toBe("image/png");
    expect(part.data).toBe("base64data");
  });
});

describe("CompletionRequest", () => {
  it("works without content field (backward compatible)", () => {
    const req: CompletionRequest = {
      model: "gemini-2.0-flash",
      systemPrompt: "You are helpful.",
      userPrompt: "Hello",
    };
    expect(req.content).toBeUndefined();
    expect(req.userPrompt).toBe("Hello");
  });

  it("works with content field (multimodal)", () => {
    const req: CompletionRequest = {
      model: "gemini-2.5-pro",
      systemPrompt: "Evaluate this page.",
      userPrompt: "",
      content: [
        { type: "text", text: "Evaluate the screenshots" },
        { type: "image", mimeType: "image/png", data: "base64data" },
      ],
    };
    expect(req.content).toHaveLength(2);
    expect(req.content![0]!.type).toBe("text");
    expect(req.content![1]!.type).toBe("image");
  });
});

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
