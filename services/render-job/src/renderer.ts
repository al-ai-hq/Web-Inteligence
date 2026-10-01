import { chromium } from "playwright";
import { createHash } from "node:crypto";
import type { RenderConfig } from "./config/schema.js";
import { interceptRequest } from "./request-interceptor.js";

export interface RenderResult {
  url: string;
  renderedAt: string;
  domSnapshot: string;
  contentHash: string;
  renderDurationMs: number;
}

export interface RenderPageOptions {
  url: string;
  config: RenderConfig;
}

export async function renderPage(options: RenderPageOptions): Promise<RenderResult> {
  const { url, config } = options;

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--no-sandbox",
    ],
  });

  try {
    const context = await browser.newContext({
      javaScriptEnabled: true,
      bypassCSP: false,
      serviceWorkers: "block",
    });

    // Block downloads
    context.on("page", (page) => {
      page.on("download", (download) => download.cancel());
    });

    const page = await context.newPage();

    // Set up request interception
    await page.route("**/*", async (route) => {
      const request = route.request();
      const allowed = await interceptRequest(request);
      if (allowed) {
        await route.continue();
      } else {
        await route.abort();
      }
    });

    // Navigate and capture
    const startTime = Date.now();
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: config.per_page_timeout_seconds * 1000,
    });

    const domSnapshot = await page.content();
    const renderDurationMs = Date.now() - startTime;

    const contentHash = createHash("sha256").update(domSnapshot).digest("hex");

    return {
      url,
      renderedAt: new Date().toISOString(),
      domSnapshot,
      contentHash,
      renderDurationMs,
    };
  } finally {
    await browser.close();
  }
}
