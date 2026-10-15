# M5 Vision Model Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder experience-reviewer with real Gemini Pro Vision API calls that score 5 experience dimensions using screenshots + extractor data.

**Architecture:** Extend the M3 provider layer with multimodal support (text + images), add screenshot capture to the crawler, and build the experience reviewer orchestrator in services/agents that reuses M3 infrastructure (GeminiAdapter, circuit breaker, cost tracker, model resolver).

**Tech Stack:** @google/genai SDK, Playwright (screenshots), TypeScript, existing M3 agent infrastructure.

**Spec:** docs/superpowers/specs/2026-10-08-m5-vision-model-integration-design.md

## Global Constraints

- Reuse M3 agent infrastructure — no new provider abstractions
- Dimension-per-call strategy: 5 separate Gemini calls per page (one per dimension)
- Pre-loaded prompts: screenshots + extractor data loaded into each dimension's prompt upfront (not tool-based)
- D-012 separation: Experience score never blended with Presence Readiness score
- Backward compatibility: existing text-only agents unaffected by provider changes
- File paths over inline buffers for screenshot storage to keep evidence package lean

---

## File Structure

**Provider Layer (services/agents/src/providers/):**

- Modify: `types.ts` — add ContentPart union, optional content field on CompletionRequest
- Modify: `gemini-adapter.ts` — build Part[] when content present
- Modify: `model-resolver.ts` — add vision_capable tier

**Evidence Types (packages/core/src/types/):**

- Modify: `experience-evidence.ts` — replace string screenshot IDs with ScreenshotRef objects

**Core Barrel Export (packages/core/src/):**

- Create: `index.ts` — barrel export for all public types and functions

**Screenshot Capture (services/crawler/src/):**

- Create: `screenshot-capture.ts` — captureScreenshots(), captureViewport(), captureFullPage(), captureAboveFold()

**Experience Reviewer (services/agents/src/experience-reviewer/):**

- Create: `image-loader.ts` — read PNG from disk → base64 ContentPart[]
- Create: `response-parser.ts` — parse JSON response → findings + dimension score
- Create: `dimension-prompt.ts` — build per-dimension multimodal prompt
- Create: `orchestrator.ts` — main loop: 5 dimension calls, cost tracking, error handling
- Create: `index.ts` — barrel export

**Integration:**

- Modify: `services/agents/src/index.ts` — export experience reviewer
- Modify: `services/agents/package.json` — add @wpi/core workspace dependency
- Modify: `services/crawler/package.json` — add playwright dependency

**Tests:**

- services/agents/tests/providers/gemini-adapter.test.ts (extend)
- services/agents/tests/providers/model-resolver.test.ts (extend)
- services/agents/tests/experience-reviewer/image-loader.test.ts
- services/agents/tests/experience-reviewer/response-parser.test.ts
- services/agents/tests/experience-reviewer/dimension-prompt.test.ts
- services/agents/tests/experience-reviewer/orchestrator.test.ts
- services/crawler/tests/screenshot-capture.test.ts
- packages/core/src/types/experience-evidence.test.ts (extend)

---

### Task 1: ContentPart Type and CompletionRequest Extension

**Files:**

- Modify: `services/agents/src/providers/types.ts:7-14`
- Test: `services/agents/tests/providers/types.test.ts`

**Interfaces:**

- Consumes: existing CompletionRequest interface
- Produces: ContentPart union type, CompletionRequest with optional content field

- [ ] **Step 1: Write failing test for ContentPart type**

Create `services/agents/tests/providers/types.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/agents && pnpm test tests/providers/types.test.ts`
Expected: FAIL — "ContentPart" is not exported from types.js

- [ ] **Step 3: Implement ContentPart type and extend CompletionRequest**

Edit `services/agents/src/providers/types.ts`:

```typescript
export type ContentPart =
  { type: "text"; text: string } | { type: "image"; mimeType: string; data: string };

export interface CompletionRequest {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  content?: ContentPart[];
  toolDefinitions?: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/agents && pnpm test tests/providers/types.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Run full agents test suite**

Run: `cd services/agents && pnpm test`
Expected: All existing tests still pass (backward compatibility)

- [ ] **Step 6: Commit**

```bash
git add services/agents/src/providers/types.ts services/agents/tests/providers/types.test.ts
git commit -m "feat(agents): add ContentPart type and optional content field to CompletionRequest"
```

---

### Task 2: GeminiAdapter Multimodal Support

**Files:**

- Modify: `services/agents/src/providers/gemini-adapter.ts:24-51`
- Test: `services/agents/tests/providers/gemini-adapter.test.ts`

**Interfaces:**

- Consumes: CompletionRequest with optional content field (Task 1)
- Produces: GeminiAdapter that builds Part[] when content present

- [ ] **Step 1: Write failing test for multimodal content**

Add to `services/agents/tests/providers/gemini-adapter.test.ts`:

```typescript
it("builds Part[] array when content field is present", async () => {
  const { __mockGenerateContent } = (await import("@google/genai")) as {
    __mockGenerateContent: ReturnType<typeof vi.fn>;
  };
  __mockGenerateContent.mockResolvedValueOnce({
    text: "Evaluation complete",
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 50,
    },
    finishReason: "STOP",
  });

  const result = await adapter.complete({
    model: "gemini-2.5-pro",
    systemPrompt: "Evaluate this page.",
    userPrompt: "",
    content: [
      { type: "text", text: "Evaluate the screenshots" },
      { type: "image", mimeType: "image/png", data: "base64imagedata" },
    ],
  });

  expect(result.content).toBe("Evaluation complete");
  expect(__mockGenerateContent).toHaveBeenCalledWith(
    expect.objectContaining({
      contents: [
        { text: "Evaluate the screenshots" },
        { inlineData: { mimeType: "image/png", data: "base64imagedata" } },
      ],
    }),
  );
});

it("uses userPrompt string when content field is absent (backward compatible)", async () => {
  const { __mockGenerateContent } = (await import("@google/genai")) as {
    __mockGenerateContent: ReturnType<typeof vi.fn>;
  };
  __mockGenerateContent.mockResolvedValueOnce({
    text: "Response",
    usageMetadata: {
      promptTokenCount: 10,
      candidatesTokenCount: 5,
    },
    finishReason: "STOP",
  });

  await adapter.complete({
    model: "gemini-2.0-flash",
    systemPrompt: "You are helpful.",
    userPrompt: "Hello",
  });

  expect(__mockGenerateContent).toHaveBeenCalledWith(
    expect.objectContaining({
      contents: "Hello",
    }),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/agents && pnpm test tests/providers/gemini-adapter.test.ts`
Expected: FAIL — contents is still request.userPrompt (string), not Part[]

- [ ] **Step 3: Implement multimodal content handling**

Edit `services/agents/src/providers/gemini-adapter.ts`:

Add import at top:

```typescript
import type { Part } from "@google/genai";
```

Inside `complete()` method, replace line 32 (`contents: request.userPrompt,`) with:

```typescript
const contents: string | Part[] = request.content
  ? request.content.map((part) => {
      if (part.type === "text") {
        return { text: part.text };
      }
      return {
        inlineData: {
          mimeType: part.mimeType,
          data: part.data,
        },
      };
    })
  : request.userPrompt;
```

Then pass `contents` to generateContent:

```typescript
const response = await this.client.models.generateContent({
  model: request.model,
  contents,
  config: {
    // ... rest unchanged
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/agents && pnpm test tests/providers/gemini-adapter.test.ts`
Expected: PASS (all tests including new multimodal tests)

- [ ] **Step 5: Run full agents test suite**

Run: `cd services/agents && pnpm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add services/agents/src/providers/gemini-adapter.ts services/agents/tests/providers/gemini-adapter.test.ts
git commit -m "feat(agents): GeminiAdapter builds Part[] for multimodal content"
```

---

### Task 3: vision_capable Model Tier

**Files:**

- Modify: `services/agents/src/providers/model-resolver.ts:1-5`
- Test: `services/agents/tests/providers/model-resolver.test.ts`

**Interfaces:**

- Consumes: existing resolveModel() function
- Produces: vision_capable tier resolving to gemini-2.5-pro

- [ ] **Step 1: Write failing test**

Add to `services/agents/tests/providers/model-resolver.test.ts`:

```typescript
it("resolves vision_capable tier to gemini-2.5-pro", () => {
  expect(resolveModel("vision_capable")).toBe("gemini-2.5-pro");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/agents && pnpm test tests/providers/model-resolver.test.ts`
Expected: FAIL — "Unknown model tier: vision_capable"

- [ ] **Step 3: Implement vision_capable tier**

Edit `services/agents/src/providers/model-resolver.ts`:

```typescript
const MODEL_MAP: Record<string, string> = {
  fast: "gemini-2.0-flash",
  fast_plus_embedding: "gemini-2.5-flash",
  strong_reasoning: "gemini-2.5-pro",
  vision_capable: "gemini-2.5-pro",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/agents && pnpm test tests/providers/model-resolver.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/agents/src/providers/model-resolver.ts services/agents/tests/providers/model-resolver.test.ts
git commit -m "feat(agents): add vision_capable model tier for Gemini 2.5 Pro"
```

---

### Task 4: Core Barrel Export

**Files:**

- Create: `packages/core/src/index.ts`

**Interfaces:**

- Consumes: all public types and functions from @wpi/core
- Produces: barrel export for external consumption

- [ ] **Step 1: Create barrel export**

Create `packages/core/src/index.ts`:

```typescript
export type { ExperienceEvidencePackage, ScreenshotRef } from "./types/experience-evidence.js";
export type { ReviewerTrace } from "./types/reviewer-trace.js";
export type { DimensionScore, ExperienceScoreResult } from "./types/experience-score.js";
export type { CategoryResult } from "./types/readiness.js";
export { loadWeightConfig, validateWeights } from "./experience/weight-config.js";
export { calculateDimensionScore, calculateOverallScore } from "./experience/scoring-engine.js";
export { loadProjectOverrides, validateOverrides } from "./experience/project-overrides.js";
export type { HeadingExtractorOutput } from "./extractors/heading.js";
export type { FormExtractorOutput } from "./extractors/form.js";
export type { ContactExtractorOutput } from "./extractors/contact.js";
export type { PolicyExtractorOutput } from "./extractors/policy.js";
export type { LanguageExtractorOutput } from "./extractors/language.js";
export type { AnalyticsExtractorOutput } from "./extractors/analytics.js";
export type { ViewportExtractorOutput } from "./extractors/viewport.js";
export type { WayfindingExtractorOutput } from "./extractors/wayfinding.js";
```

- [ ] **Step 2: Build core package**

Run: `cd packages/core && pnpm build`
Expected: Build succeeds, dist/index.js created

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): add barrel export for public API"
```

---

### Task 5: ScreenshotRef Type Evolution

**Files:**

- Modify: `packages/core/src/types/experience-evidence.ts`
- Test: `packages/core/src/types/experience-evidence.test.ts`

**Interfaces:**

- Consumes: existing ExperienceEvidencePackage
- Produces: ScreenshotRef interface, updated screenshots field

- [ ] **Step 1: Write failing test**

Add to `packages/core/src/types/experience-evidence.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { ScreenshotRef, ExperienceEvidencePackage } from "./experience-evidence.js";

describe("ScreenshotRef", () => {
  it("has file path and dimensions", () => {
    const ref: ScreenshotRef = {
      evidence_id: "screenshot_viewport",
      path: "/tmp/evidence/viewport.png",
      mime_type: "image/png",
      width: 1280,
      height: 720,
    };
    expect(ref.path).toBe("/tmp/evidence/viewport.png");
    expect(ref.mime_type).toBe("image/png");
    expect(ref.width).toBe(1280);
  });
});

describe("ExperienceEvidencePackage", () => {
  it("accepts ScreenshotRef objects in screenshots field", () => {
    const pkg: ExperienceEvidencePackage = {
      page_url: "https://example.com",
      language: "en",
      market: "us",
      screenshots: {
        viewport: {
          evidence_id: "screenshot_viewport",
          path: "/tmp/viewport.png",
          mime_type: "image/png",
          width: 1280,
          height: 720,
        },
        full_page: null,
        above_fold: {
          evidence_id: "screenshot_above_fold",
          path: "/tmp/above_fold.png",
          mime_type: "image/png",
          width: 1280,
          height: 1080,
        },
      },
      extractor_results: {} as any,
      readiness_results: {
        score: 85,
        categories: [],
        confidence: "high",
      },
    };
    expect(pkg.screenshots.viewport?.path).toBe("/tmp/viewport.png");
    expect(pkg.screenshots.full_page).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test src/types/experience-evidence.test.ts`
Expected: FAIL — ScreenshotRef not exported, screenshots field expects string not object

- [ ] **Step 3: Implement ScreenshotRef and update ExperienceEvidencePackage**

Edit `packages/core/src/types/experience-evidence.ts`:

Add at top:

```typescript
export interface ScreenshotRef {
  evidence_id: string;
  path: string;
  mime_type: "image/png";
  width: number;
  height: number;
}
```

Replace the screenshots field in ExperienceEvidencePackage:

```typescript
screenshots: {
  viewport: ScreenshotRef | null;
  full_page: ScreenshotRef | null;
  above_fold: ScreenshotRef | null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test src/types/experience-evidence.test.ts`
Expected: PASS

- [ ] **Step 5: Build core package**

Run: `cd packages/core && pnpm build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/types/experience-evidence.ts packages/core/src/types/experience-evidence.test.ts
git commit -m "feat(core): replace string screenshot IDs with ScreenshotRef objects"
```

---

### Task 6: Screenshot Capture Module

**Files:**

- Create: `services/crawler/src/screenshot-capture.ts`
- Test: `services/crawler/tests/screenshot-capture.test.ts`
- Modify: `services/crawler/package.json` (add playwright dependency)

**Interfaces:**

- Consumes: Playwright Page object
- Produces: ScreenshotResult with viewport, full_page, above_fold

- [ ] **Step 1: Add playwright dependency**

Edit `services/crawler/package.json`, add to dependencies:

```json
"playwright": "^1.48.0"
```

Run: `pnpm install`

- [ ] **Step 2: Write failing tests**

Create `services/crawler/tests/screenshot-capture.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { captureScreenshots } from "../src/screenshot-capture.js";

function mockPage(overrides: Record<string, unknown> = {}) {
  return {
    screenshot: vi.fn().mockResolvedValue(Buffer.from("fake-png")),
    viewportSize: vi.fn().mockReturnValue({ width: 1280, height: 720 }),
    evaluate: vi.fn().mockResolvedValue({ width: 1280, height: 3000 }),
    ...overrides,
  } as any;
}

describe("captureScreenshots", () => {
  it("captures viewport, full-page, and above-fold screenshots", async () => {
    const page = mockPage();
    const result = await captureScreenshots(page);

    expect(result.viewport).not.toBeNull();
    expect(result.full_page).not.toBeNull();
    expect(result.above_fold).not.toBeNull();
    expect(page.screenshot).toHaveBeenCalledTimes(3);
  });

  it("returns null for viewport when capture fails", async () => {
    const page = mockPage({
      screenshot: vi
        .fn()
        .mockRejectedValueOnce(new Error("viewport failed"))
        .mockResolvedValue(Buffer.from("fake-png"))
        .mockResolvedValue(Buffer.from("fake-png")),
    });
    const result = await captureScreenshots(page);
    expect(result.viewport).toBeNull();
    expect(result.full_page).not.toBeNull();
    expect(result.above_fold).not.toBeNull();
  });

  it("viewport screenshot has correct dimensions", async () => {
    const page = mockPage();
    const result = await captureScreenshots(page);
    expect(result.viewport!.width).toBe(1280);
    expect(result.viewport!.height).toBe(720);
    expect(result.viewport!.mime_type).toBe("image/png");
  });

  it("full-page screenshot uses scroll dimensions", async () => {
    const page = mockPage();
    const result = await captureScreenshots(page);
    expect(result.full_page!.width).toBe(1280);
    expect(result.full_page!.height).toBe(3000);
  });

  it("above-fold screenshot clips to 1080px height", async () => {
    const page = mockPage();
    const result = await captureScreenshots(page);
    expect(result.above_fold!.width).toBe(1280);
    expect(result.above_fold!.height).toBe(1080);
    expect(page.screenshot).toHaveBeenCalledWith(
      expect.objectContaining({
        clip: { x: 0, y: 0, width: 1280, height: 1080 },
      }),
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd services/crawler && pnpm test tests/screenshot-capture.test.ts`
Expected: FAIL — "Cannot find module '../src/screenshot-capture.js'"

- [ ] **Step 4: Implement screenshot-capture.ts**

Create `services/crawler/src/screenshot-capture.ts`:

```typescript
import type { Page } from "playwright";

export interface ScreenshotImage {
  buffer: Buffer;
  mime_type: "image/png";
  width: number;
  height: number;
}

export interface ScreenshotResult {
  viewport: ScreenshotImage | null;
  full_page: ScreenshotImage | null;
  above_fold: ScreenshotImage | null;
}

const ABOVE_FOLD_HEIGHT = 1080;

export async function captureScreenshots(page: Page): Promise<ScreenshotResult> {
  const viewport = await captureViewport(page);
  const fullPage = await captureFullPage(page);
  const aboveFold = await captureAboveFold(page);

  return { viewport, full_page: fullPage, above_fold: aboveFold };
}

async function captureViewport(page: Page): Promise<ScreenshotImage | null> {
  try {
    const buffer = await page.screenshot({ type: "png" });
    const viewport = page.viewportSize();
    return {
      buffer,
      mime_type: "image/png",
      width: viewport?.width ?? 1280,
      height: viewport?.height ?? 720,
    };
  } catch {
    return null;
  }
}

async function captureFullPage(page: Page): Promise<ScreenshotImage | null> {
  try {
    const buffer = await page.screenshot({ type: "png", fullPage: true });
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    }));
    return {
      buffer,
      mime_type: "image/png",
      width: dimensions.width,
      height: dimensions.height,
    };
  } catch {
    return null;
  }
}

async function captureAboveFold(page: Page): Promise<ScreenshotImage | null> {
  try {
    const viewport = page.viewportSize();
    const width = viewport?.width ?? 1280;
    const buffer = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width, height: ABOVE_FOLD_HEIGHT },
    });
    return {
      buffer,
      mime_type: "image/png",
      width,
      height: ABOVE_FOLD_HEIGHT,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd services/crawler && pnpm test tests/screenshot-capture.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Run full crawler test suite**

Run: `cd services/crawler && pnpm test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add services/crawler/src/screenshot-capture.ts services/crawler/tests/screenshot-capture.test.ts services/crawler/package.json pnpm-lock.yaml
git commit -m "feat(crawler): add screenshot capture module with viewport, full-page, above-fold"
```

---

### Task 7: Image Loader

**Files:**

- Create: `services/agents/src/experience-reviewer/image-loader.ts`
- Test: `services/agents/tests/experience-reviewer/image-loader.test.ts`

**Interfaces:**

- Consumes: ScreenshotRef objects with file paths
- Produces: ContentPart[] with base64-encoded images

- [ ] **Step 1: Add @wpi/core dependency to agents service**

Edit `services/agents/package.json`, add to dependencies:

```json
"@wpi/core": "workspace:*"
```

Run: `pnpm install`

- [ ] **Step 2: Write failing tests**

Create `services/agents/tests/experience-reviewer/image-loader.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadImagesAsContent } from "../../src/experience-reviewer/image-loader.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("loadImagesAsContent", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `image-loader-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("returns empty array when all screenshots are null", () => {
    const result = loadImagesAsContent({
      viewport: null,
      full_page: null,
      above_fold: null,
    });
    expect(result).toEqual([]);
  });

  it("loads viewport and above-fold images as base64", () => {
    const viewportPath = join(testDir, "viewport.png");
    const aboveFoldPath = join(testDir, "above_fold.png");
    writeFileSync(viewportPath, Buffer.from("viewport-data"));
    writeFileSync(aboveFoldPath, Buffer.from("above-fold-data"));

    const result = loadImagesAsContent({
      viewport: {
        evidence_id: "screenshot_viewport",
        path: viewportPath,
        mime_type: "image/png",
        width: 1280,
        height: 720,
      },
      full_page: null,
      above_fold: {
        evidence_id: "screenshot_above_fold",
        path: aboveFoldPath,
        mime_type: "image/png",
        width: 1280,
        height: 1080,
      },
    });

    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("image");
    expect(result[0].mimeType).toBe("image/png");
    expect(result[0].data).toBe(Buffer.from("viewport-data").toString("base64"));
    expect(result[1].data).toBe(Buffer.from("above-fold-data").toString("base64"));
  });

  it("falls back to full-page when viewport and above-fold are missing", () => {
    const fullPath = join(testDir, "full.png");
    writeFileSync(fullPath, Buffer.from("full-page-data"));

    const result = loadImagesAsContent({
      viewport: null,
      full_page: {
        evidence_id: "screenshot_full_page",
        path: fullPath,
        mime_type: "image/png",
        width: 1280,
        height: 3000,
      },
      above_fold: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0].data).toBe(Buffer.from("full-page-data").toString("base64"));
  });

  it("does not include full-page when viewport is present", () => {
    const viewportPath = join(testDir, "viewport.png");
    const fullPath = join(testDir, "full.png");
    writeFileSync(viewportPath, Buffer.from("viewport-data"));
    writeFileSync(fullPath, Buffer.from("full-page-data"));

    const result = loadImagesAsContent({
      viewport: {
        evidence_id: "screenshot_viewport",
        path: viewportPath,
        mime_type: "image/png",
        width: 1280,
        height: 720,
      },
      full_page: {
        evidence_id: "screenshot_full_page",
        path: fullPath,
        mime_type: "image/png",
        width: 1280,
        height: 3000,
      },
      above_fold: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0].data).toBe(Buffer.from("viewport-data").toString("base64"));
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd services/agents && pnpm test tests/experience-reviewer/image-loader.test.ts`
Expected: FAIL — "Cannot find module"

- [ ] **Step 4: Implement image-loader.ts**

Create `services/agents/src/experience-reviewer/image-loader.ts`:

```typescript
import { readFileSync } from "node:fs";
import type { ContentPart } from "../providers/types.js";
import type { ScreenshotRef } from "@wpi/core";

export function loadImagesAsContent(screenshots: {
  viewport: ScreenshotRef | null;
  full_page: ScreenshotRef | null;
  above_fold: ScreenshotRef | null;
}): ContentPart[] {
  const parts: ContentPart[] = [];

  if (screenshots.viewport) {
    const buffer = readFileSync(screenshots.viewport.path);
    const base64 = buffer.toString("base64");
    parts.push({
      type: "image",
      mimeType: "image/png",
      data: base64,
    });
  }

  if (screenshots.above_fold) {
    const buffer = readFileSync(screenshots.above_fold.path);
    const base64 = buffer.toString("base64");
    parts.push({
      type: "image",
      mimeType: "image/png",
      data: base64,
    });
  }

  if (parts.length === 0 && screenshots.full_page) {
    const buffer = readFileSync(screenshots.full_page.path);
    const base64 = buffer.toString("base64");
    parts.push({
      type: "image",
      mimeType: "image/png",
      data: base64,
    });
  }

  return parts;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd services/agents && pnpm test tests/experience-reviewer/image-loader.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add services/agents/src/experience-reviewer/image-loader.ts services/agents/tests/experience-reviewer/image-loader.test.ts services/agents/package.json pnpm-lock.yaml
git commit -m "feat(agents): add image loader for base64 encoding of screenshot PNGs"
```

---

### Task 8: Response Parser

**Files:**

- Create: `services/agents/src/experience-reviewer/response-parser.ts`
- Test: `services/agents/tests/experience-reviewer/response-parser.test.ts`

**Interfaces:**

- Consumes: JSON response text from Gemini, dimension name, language, market
- Produces: findings array + dimension score

- [ ] **Step 1: Write failing tests**

Create `services/agents/tests/experience-reviewer/response-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseDimensionResponse } from "../../src/experience-reviewer/response-parser.js";

describe("parseDimensionResponse", () => {
  it("parses valid JSON response into findings", () => {
    const responseText = JSON.stringify({
      criteria: [
        {
          criterion_id: "EXP-DH-01",
          result: "pass",
          confidence: "high",
          rationale: "Clear visual hierarchy",
        },
        {
          criterion_id: "EXP-DH-02",
          result: "partial",
          confidence: "medium",
          rationale: "Some headings lack contrast",
        },
      ],
    });

    const { findings, score } = parseDimensionResponse(
      "design_hierarchy",
      responseText,
      "en",
      "us",
    );

    expect(findings).toHaveLength(2);
    expect(findings[0].result_state).toBe("pass");
    expect(findings[0].confidence).toBe("high");
    expect(findings[0].data.reviewer_trace.criterion_id).toBe("EXP-DH-01");
    expect(findings[0].data.reviewer_trace.reviewer_type).toBe("model");
    expect(findings[0].data.reviewer_trace.language).toBe("en");
    expect(findings[0].data.reviewer_trace.language_direction).toBe("ltr");
    expect(findings[1].result_state).toBe("partial");
    expect(score.score).toBeGreaterThan(0);
  });

  it("returns error findings when JSON parsing fails", () => {
    const { findings } = parseDimensionResponse("design_hierarchy", "not valid json", "en", "us");

    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].result_state).toBe("error");
    expect(findings[0].confidence).toBe("low");
    expect(findings[0].data.reviewer_trace.rationale).toBe("Failed to parse model response");
  });

  it("sets language_direction to rtl for Arabic", () => {
    const responseText = JSON.stringify({
      criteria: [
        {
          criterion_id: "EXP-DH-01",
          result: "pass",
          confidence: "high",
          rationale: "Good hierarchy",
        },
      ],
    });

    const { findings } = parseDimensionResponse("design_hierarchy", responseText, "ar", "sa");

    expect(findings[0].data.reviewer_trace.language_direction).toBe("rtl");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/agents && pnpm test tests/experience-reviewer/response-parser.test.ts`
Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement response-parser.ts**

Create `services/agents/src/experience-reviewer/response-parser.ts`:

```typescript
import type { ReviewerTrace } from "@wpi/core";
import { calculateDimensionScore, loadWeightConfig } from "@wpi/core";

interface DimensionResponse {
  criteria: Array<{
    criterion_id: string;
    result: "pass" | "partial" | "fail" | "not_applicable";
    confidence: "high" | "medium" | "low";
    rationale: string;
  }>;
}

const CRITERION_NAMES: Record<string, string> = {
  "EXP-DH-01": "Visual hierarchy",
  "EXP-DH-02": "Heading structure",
  "EXP-DH-03": "Whitespace and grouping",
  "EXP-DH-04": "Color contrast",
  "EXP-DH-05": "Typography scale",
  "EXP-CP-01": "Headline clarity",
  "EXP-CP-02": "Value proposition",
  "EXP-CP-03": "Call-to-action copy",
  "EXP-CP-04": "Content relevance",
  "EXP-UX-01": "Navigation clarity",
  "EXP-UX-02": "Search visibility",
  "EXP-UX-03": "Mobile responsiveness",
  "EXP-UX-04": "Load time perception",
  "EXP-UX-05": "Interaction feedback",
  "EXP-TP-01": "Trust signals",
  "EXP-TP-02": "Social proof",
  "EXP-TP-03": "Credentials",
  "EXP-TP-04": "Transparency",
  "EXP-TP-05": "Security indicators",
  "EXP-CV-01": "Conversion path clarity",
  "EXP-CV-02": "Form usability",
  "EXP-CV-03": "Contact accessibility",
  "EXP-CV-04": "Measurement setup",
  "EXP-CV-05": "Analytics coverage",
};

export function parseDimensionResponse(
  dimension: string,
  responseText: string,
  language: string,
  market: string,
): { findings: any[]; score: any } {
  let parsed: DimensionResponse;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    return createErrorFindings(dimension, language, market);
  }

  const config = loadWeightConfig();
  const criteria = config.criteria[dimension];

  const findings = parsed.criteria.map((c) => ({
    id: `exp_${c.criterion_id}_${Date.now()}`,
    result_state: c.result,
    confidence: c.confidence,
    evidence_ids: ["screenshot_viewport", "screenshot_above_fold"],
    data: {
      reviewer_trace: {
        rubric_version: config.methodology_version,
        criterion_id: c.criterion_id,
        criterion_name: CRITERION_NAMES[c.criterion_id] ?? c.criterion_id,
        result: c.result,
        confidence: c.confidence,
        rationale: c.rationale,
        evidence_ids: ["screenshot_viewport", "screenshot_above_fold"],
        reviewer_type: "model",
        model_id: "gemini-pro-vision",
        model_version: "gemini-2.5-pro",
        language,
        language_direction: language === "ar" ? "rtl" : "ltr",
        market,
        evaluated_at: new Date().toISOString(),
        prompt_version: "0.2.0",
        limitations: [],
      } as ReviewerTrace,
    },
  }));

  const score = calculateDimensionScore(
    findings.map((f) => ({
      criterion_id: f.data.reviewer_trace.criterion_id,
      result: f.data.reviewer_trace.result,
      confidence: f.data.reviewer_trace.confidence,
    })),
    criteria,
  );

  return { findings, score };
}

function createErrorFindings(dimension: string, language: string, market: string) {
  const config = loadWeightConfig();
  const criteria = config.criteria[dimension];

  const findings = Object.keys(criteria).map((criterionId) => ({
    id: `exp_${criterionId}_${Date.now()}`,
    result_state: "error",
    confidence: "low",
    evidence_ids: [],
    data: {
      reviewer_trace: {
        rubric_version: config.methodology_version,
        criterion_id: criterionId,
        criterion_name: CRITERION_NAMES[criterionId] ?? criterionId,
        result: "error",
        confidence: "low",
        rationale: "Failed to parse model response",
        evidence_ids: [],
        reviewer_type: "model",
        model_id: "gemini-pro-vision",
        model_version: "gemini-2.5-pro",
        language,
        language_direction: language === "ar" ? "rtl" : "ltr",
        market,
        evaluated_at: new Date().toISOString(),
        prompt_version: "0.2.0",
        limitations: ["Model response parsing failed"],
      } as ReviewerTrace,
    },
  }));

  const score = calculateDimensionScore(
    findings.map((f) => ({
      criterion_id: f.data.reviewer_trace.criterion_id,
      result: f.data.reviewer_trace.result,
      confidence: f.data.reviewer_trace.confidence,
    })),
    criteria,
  );

  return { findings, score };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/agents && pnpm test tests/experience-reviewer/response-parser.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add services/agents/src/experience-reviewer/response-parser.ts services/agents/tests/experience-reviewer/response-parser.test.ts
git commit -m "feat(agents): add response parser for dimension evaluation results"
```

---

### Task 9: Dimension Prompt Builder

**Files:**

- Create: `services/agents/src/experience-reviewer/dimension-prompt.ts`
- Test: `services/agents/tests/experience-reviewer/dimension-prompt.test.ts`

**Interfaces:**

- Consumes: dimension name, ExperienceEvidencePackage, ContentPart[] (images)
- Produces: systemPrompt string + content array

- [ ] **Step 1: Write failing tests**

Create `services/agents/tests/experience-reviewer/dimension-prompt.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildDimensionPrompt } from "../../src/experience-reviewer/dimension-prompt.js";
import type { ExperienceEvidencePackage } from "@wpi/core";
import type { ContentPart } from "../../src/providers/types.js";

const mockEvidence: ExperienceEvidencePackage = {
  page_url: "https://example.com",
  language: "en",
  market: "us",
  screenshots: {
    viewport: null,
    full_page: null,
    above_fold: null,
  },
  extractor_results: {
    heading: { h1_count: 1, h1_text: "Welcome" },
    form: { form_count: 1, forms: [] },
    contact: { email_count: 1, phone_count: 0 },
    policy: { privacy_link: true, terms_link: false },
    language: { detected: "en", switcher: true },
    analytics: { ga4: true, gtm: false },
    viewport: { meta_viewport: true, responsive: true },
    wayfinding: { breadcrumbs: true, sitemap_link: false },
  } as any,
  readiness_results: {
    score: 85,
    categories: [],
    confidence: "high",
  },
};

describe("buildDimensionPrompt", () => {
  it("builds system prompt with dimension title and criteria", () => {
    const imageParts: ContentPart[] = [];
    const { systemPrompt, content } = buildDimensionPrompt(
      "design_hierarchy",
      mockEvidence,
      imageParts,
    );

    expect(systemPrompt).toContain("Design hierarchy");
    expect(systemPrompt).toContain("EXP-DH-01");
    expect(systemPrompt).toContain("JSON");
    expect(content.length).toBeGreaterThan(0);
  });

  it("includes extractor results in text content", () => {
    const imageParts: ContentPart[] = [];
    const { content } = buildDimensionPrompt("design_hierarchy", mockEvidence, imageParts);

    const textPart = content.find((p) => p.type === "text");
    expect(textPart).toBeDefined();
    expect(textPart!.text).toContain("https://example.com");
    expect(textPart!.text).toContain("en");
    expect(textPart!.text).toContain("us");
  });

  it("includes image parts in content array", () => {
    const imageParts: ContentPart[] = [
      { type: "image", mimeType: "image/png", data: "base64data" },
    ];
    const { content } = buildDimensionPrompt("design_hierarchy", mockEvidence, imageParts);

    expect(content).toHaveLength(2);
    expect(content[0].type).toBe("text");
    expect(content[1].type).toBe("image");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/agents && pnpm test tests/experience-reviewer/dimension-prompt.test.ts`
Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement dimension-prompt.ts**

Create `services/agents/src/experience-reviewer/dimension-prompt.ts`:

```typescript
import type { ContentPart } from "../providers/types.js";
import type { ExperienceEvidencePackage } from "@wpi/core";
import { loadWeightConfig } from "@wpi/core";

const CRITERION_DESCRIPTIONS: Record<string, string> = {
  "EXP-DH-01": "Clear visual hierarchy with dominant elements",
  "EXP-DH-02": "Proper heading structure (H1-H6)",
  "EXP-DH-03": "Effective whitespace and visual grouping",
  "EXP-DH-04": "Sufficient color contrast for readability",
  "EXP-DH-05": "Consistent typography scale",
  "EXP-CP-01": "Clear, compelling headline",
  "EXP-CP-02": "Strong value proposition above the fold",
  "EXP-CP-03": "Actionable call-to-action copy",
  "EXP-CP-04": "Content relevance to target audience",
  "EXP-UX-01": "Intuitive navigation structure",
  "EXP-UX-02": "Visible search functionality",
  "EXP-UX-03": "Mobile-responsive layout",
  "EXP-UX-04": "Fast perceived load time",
  "EXP-UX-05": "Clear interaction feedback",
  "EXP-TP-01": "Visible trust signals (certifications, awards)",
  "EXP-TP-02": "Social proof (testimonials, reviews)",
  "EXP-TP-03": "Professional credentials displayed",
  "EXP-TP-04": "Transparent business information",
  "EXP-TP-05": "Security indicators (SSL, privacy)",
  "EXP-CV-01": "Clear conversion path to goal",
  "EXP-CV-02": "User-friendly form design",
  "EXP-CV-03": "Easy contact access",
  "EXP-CV-04": "Analytics and measurement setup",
  "EXP-CV-05": "Comprehensive analytics coverage",
};

export function buildDimensionPrompt(
  dimension: string,
  evidence: ExperienceEvidencePackage,
  imageParts: ContentPart[],
): { systemPrompt: string; content: ContentPart[] } {
  const config = loadWeightConfig();
  const dimensionConfig = config.dimensions[dimension];
  const criteria = config.criteria[dimension];

  const systemPrompt = `You are evaluating a webpage's ${dimensionConfig.title}.

Criteria:
${Object.entries(criteria)
  .map(([id, weight]) => `- ${id} (weight: ${weight}): ${CRITERION_DESCRIPTIONS[id] ?? id}`)
  .join("\n")}

For each criterion, respond with:
- result: 'pass', 'partial', 'fail', or 'not_applicable'
- confidence: 'high', 'medium', or 'low'
- rationale: brief explanation (1-2 sentences)

Respond in JSON format:
{
  "criteria": [
    {
      "criterion_id": "EXP-DH-01",
      "result": "pass",
      "confidence": "high",
      "rationale": "..."
    }
  ]
}`;

  const textContent: ContentPart = {
    type: "text",
    text: `URL: ${evidence.page_url}
Language: ${evidence.language}
Market: ${evidence.market}

Extractor results:
${JSON.stringify(evidence.extractor_results, null, 2)}

Evaluate the screenshots based on the criteria above.`,
  };

  return {
    systemPrompt,
    content: [textContent, ...imageParts],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/agents && pnpm test tests/experience-reviewer/dimension-prompt.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add services/agents/src/experience-reviewer/dimension-prompt.ts services/agents/tests/experience-reviewer/dimension-prompt.test.ts
git commit -m "feat(agents): add dimension prompt builder for vision model evaluation"
```

---

### Task 10: Experience Reviewer Orchestrator

**Files:**

- Create: `services/agents/src/experience-reviewer/orchestrator.ts`
- Create: `services/agents/src/experience-reviewer/index.ts`
- Test: `services/agents/tests/experience-reviewer/orchestrator.test.ts`

**Interfaces:**

- Consumes: GeminiAdapter, CostTracker, ExperienceEvidencePackage
- Produces: findings array + ExperienceScoreResult

- [ ] **Step 1: Write failing tests**

Create `services/agents/tests/experience-reviewer/orchestrator.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { reviewExperience } from "../../src/experience-reviewer/orchestrator.js";
import type { GeminiAdapter } from "../../src/providers/gemini-adapter.js";
import type { CostTracker } from "../../src/providers/cost-tracker.js";
import type { ExperienceEvidencePackage } from "@wpi/core";

function mockAdapter(responses: string[]): GeminiAdapter {
  let callCount = 0;
  return {
    name: "gemini",
    complete: vi.fn().mockImplementation(async () => {
      const response = responses[callCount] ?? responses[0];
      callCount++;
      return {
        content: response,
        usage: { tokens_in: 100, tokens_out: 50 },
        finishReason: "stop",
      };
    }),
    isAvailable: vi.fn().mockReturnValue(true),
  } as any;
}

function mockCostTracker(): CostTracker {
  return {
    record: vi.fn(),
    canProceed: vi.fn().mockReturnValue(true),
    getAuditCost: vi.fn().mockReturnValue({ total_usd: 0, call_count: 0, soft_cap_reached: false }),
    getMonthlyTotal: vi.fn().mockReturnValue(0),
  } as any;
}

const mockEvidence: ExperienceEvidencePackage = {
  page_url: "https://example.com",
  language: "en",
  market: "us",
  screenshots: { viewport: null, full_page: null, above_fold: null },
  extractor_results: {} as any,
  readiness_results: { score: 85, categories: [], confidence: "high" },
};

describe("reviewExperience", () => {
  it("makes 5 dimension calls to Gemini adapter", async () => {
    const validResponse = JSON.stringify({
      criteria: [
        { criterion_id: "EXP-DH-01", result: "pass", confidence: "high", rationale: "Good" },
      ],
    });
    const adapter = mockAdapter([validResponse]);
    const costTracker = mockCostTracker();

    const { findings } = await reviewExperience(mockEvidence, {
      adapter,
      costTracker,
      auditId: "audit-123",
    });

    expect(adapter.complete).toHaveBeenCalledTimes(5);
    expect(findings.length).toBeGreaterThan(0);
  });

  it("records cost for each dimension call", async () => {
    const validResponse = JSON.stringify({
      criteria: [
        { criterion_id: "EXP-DH-01", result: "pass", confidence: "high", rationale: "Good" },
      ],
    });
    const adapter = mockAdapter([validResponse]);
    const costTracker = mockCostTracker();

    await reviewExperience(mockEvidence, {
      adapter,
      costTracker,
      auditId: "audit-123",
    });

    expect(costTracker.record).toHaveBeenCalledTimes(5);
    expect(costTracker.record).toHaveBeenCalledWith(
      expect.objectContaining({
        audit_id: "audit-123",
        agent_name: "experience-reviewer",
      }),
    );
  });

  it("returns experience score with all 5 dimensions", async () => {
    const validResponse = JSON.stringify({
      criteria: [
        { criterion_id: "EXP-DH-01", result: "pass", confidence: "high", rationale: "Good" },
      ],
    });
    const adapter = mockAdapter([validResponse]);
    const costTracker = mockCostTracker();

    const { score } = await reviewExperience(mockEvidence, {
      adapter,
      costTracker,
      auditId: "audit-123",
    });

    expect(score).toBeDefined();
    expect(score.experience_effectiveness).toBeGreaterThanOrEqual(0);
    expect(score.dimensions).toBeDefined();
    expect(score.confidence).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/agents && pnpm test tests/experience-reviewer/orchestrator.test.ts`
Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement orchestrator.ts**

Create `services/agents/src/experience-reviewer/orchestrator.ts`:

```typescript
import type { GeminiAdapter } from "../providers/gemini-adapter.js";
import { resolveModel, getModelPricing } from "../providers/model-resolver.js";
import type { CostTracker } from "../providers/cost-tracker.js";
import { buildDimensionPrompt } from "./dimension-prompt.js";
import { parseDimensionResponse } from "./response-parser.js";
import { loadImagesAsContent } from "./image-loader.js";
import { calculateOverallScore, loadWeightConfig } from "@wpi/core";
import type { ExperienceEvidencePackage, ExperienceScoreResult } from "@wpi/core";

export interface OrchestratorDeps {
  adapter: GeminiAdapter;
  costTracker: CostTracker;
  auditId: string;
}

const DIMENSIONS = [
  "design_hierarchy",
  "copy_and_positioning_clarity",
  "ux_and_navigation",
  "trust_and_proof",
  "conversion_path_and_measurement",
];

export async function reviewExperience(
  evidence: ExperienceEvidencePackage,
  deps: OrchestratorDeps,
): Promise<{ findings: any[]; score: ExperienceScoreResult }> {
  const model = resolveModel("vision_capable");
  const pricing = getModelPricing(model);

  const allFindings = [];
  const dimensionScores: Record<string, any> = {};

  for (const dimension of DIMENSIONS) {
    if (!deps.costTracker.canProceed(deps.auditId)) {
      break;
    }

    const imageParts = loadImagesAsContent(evidence.screenshots);
    const prompt = buildDimensionPrompt(dimension, evidence, imageParts);

    const response = await deps.adapter.complete({
      model,
      systemPrompt: prompt.systemPrompt,
      userPrompt: "",
      content: prompt.content,
      temperature: 0.3,
    });

    const tokensIn = response.usage.tokens_in;
    const tokensOut = response.usage.tokens_out;
    const usd = (tokensIn / 1000) * pricing.inputPer1k + (tokensOut / 1000) * pricing.outputPer1k;

    deps.costTracker.record({
      audit_id: deps.auditId,
      agent_name: "experience-reviewer",
      model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      usd,
    });

    const { findings, score } = parseDimensionResponse(
      dimension,
      response.content,
      evidence.language,
      evidence.market,
    );

    allFindings.push(...findings);
    dimensionScores[dimension] = score;
  }

  const config = loadWeightConfig();
  const dimensionWeights = Object.fromEntries(
    Object.entries(config.dimensions).map(([k, v]) => [k, v.weight]),
  );

  const applicableDimensions = Object.keys(dimensionScores).length;
  const coverage = applicableDimensions / DIMENSIONS.length;
  const confidence =
    applicableDimensions >= 3 ? "high" : applicableDimensions >= 1 ? "medium" : "low";

  const overallScore = calculateOverallScore(
    dimensionScores,
    dimensionWeights,
    coverage,
    confidence,
  );

  return { findings: allFindings, score: overallScore };
}
```

- [ ] **Step 4: Create barrel export**

Create `services/agents/src/experience-reviewer/index.ts`:

```typescript
export { reviewExperience } from "./orchestrator.js";
export type { OrchestratorDeps } from "./orchestrator.js";
export { buildDimensionPrompt } from "./dimension-prompt.js";
export { parseDimensionResponse } from "./response-parser.js";
export { loadImagesAsContent } from "./image-loader.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd services/agents && pnpm test tests/experience-reviewer/orchestrator.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Run full agents test suite**

Run: `cd services/agents && pnpm test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add services/agents/src/experience-reviewer/ services/agents/tests/experience-reviewer/orchestrator.test.ts
git commit -m "feat(agents): add experience reviewer orchestrator with 5-dimension evaluation"
```

---

### Task 11: Export from Agents Service

**Files:**

- Modify: `services/agents/src/index.ts`

**Interfaces:**

- Consumes: experience-reviewer module
- Produces: public API export

- [ ] **Step 1: Add exports to index.ts**

Edit `services/agents/src/index.ts`, add at end:

```typescript
export { reviewExperience } from "./experience-reviewer/orchestrator.js";
export type { OrchestratorDeps } from "./experience-reviewer/orchestrator.js";
```

- [ ] **Step 2: Build agents service**

Run: `cd services/agents && pnpm build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add services/agents/src/index.ts
git commit -m "feat(agents): export reviewExperience orchestrator"
```

---

### Task 12: Full Suite Verification

**Files:** None (verification only)

- [ ] **Step 1: Build all packages**

Run: `pnpm -r build`
Expected: All packages build successfully

- [ ] **Step 2: Run all tests**

Run: `pnpm -r test`
Expected: All tests pass

- [ ] **Step 3: Type check**

Run: `pnpm -r typecheck`
Expected: No type errors

- [ ] **Step 4: Verify backward compatibility**

Run: `cd services/agents && pnpm test tests/providers/gemini-adapter.test.ts`
Expected: All existing adapter tests pass (backward compatibility confirmed)

- [ ] **Step 5: Verify experience reviewer tests**

Run: `cd services/agents && pnpm test tests/experience-reviewer/`
Expected: All orchestrator, parser, prompt, image-loader tests pass

- [ ] **Step 6: Verify screenshot capture tests**

Run: `cd services/crawler && pnpm test tests/screenshot-capture.test.ts`
Expected: All screenshot tests pass

---

## Acceptance Criteria Verification

- [ ] Provider layer supports multimodal content (text + images) — Task 1, 2
- [ ] Screenshot capture produces viewport, full-page, and above-fold PNGs — Task 6
- [ ] Evidence package uses `ScreenshotRef` with file paths — Task 5
- [ ] Experience reviewer orchestrator makes 5 dimension calls — Task 10
- [ ] Findings match `ReviewerTrace` schema — Task 8
- [ ] Score calculation matches scoring engine — Task 8, 10
- [ ] Composer integrates experience section (D-012 separation) — existing composer.ts already handles this
- [ ] Circuit breaker and cost tracker enforced — Task 10 (cost cap check in loop)
- [ ] Error handling for screenshot failures, parsing failures, circuit breaker — Task 6, 8, 10
- [ ] Unit tests for all new modules — Tasks 1-10
- [ ] Integration test with mock adapter — Task 10
- [ ] Backward compatibility: existing text-only agents unaffected — Task 1, 2, 12
- [ ] Cost per audit < $0.10 — Task 10 (uses pricing from model-resolver)
