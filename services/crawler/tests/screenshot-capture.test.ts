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
