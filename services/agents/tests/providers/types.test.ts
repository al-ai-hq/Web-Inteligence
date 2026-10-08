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
