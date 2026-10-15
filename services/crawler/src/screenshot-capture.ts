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
    const dimensions = (await page.evaluate(
      "({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })",
    )) as { width: number; height: number };
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
