import * as cheerio from "cheerio";
import type { EvidencePackage, ViewportMetrics } from "./types";

export function extractViewportMetrics(evidence: EvidencePackage): ViewportMetrics {
  const $ = cheerio.load(evidence.html);
  const overflowElements: string[] = [];
  let maxContentWidth = 0;

  $("[style]").each((_, element) => {
    const $el = $(element);
    const style = $el.attr("style") || "";
    const tagName = element.tagName.toLowerCase();

    const widthMatch = style.match(/(?:^|;|\s)width:\s*(\d+)px/i);
    const minWidthMatch = style.match(/min-width:\s*(\d+)px/i);
    const maxWidthMatch = style.match(/max-width:\s*(\d+)px/i);

    if (widthMatch) {
      const width = parseInt(widthMatch[1], 10);
      if (width > evidence.viewportWidth) {
        overflowElements.push(`${tagName}[style*="width: ${width}px"]`);
        maxContentWidth = Math.max(maxContentWidth, width);
      }
    }

    if (minWidthMatch) {
      const minWidth = parseInt(minWidthMatch[1], 10);
      if (minWidth > evidence.viewportWidth) {
        overflowElements.push(`${tagName}[style*="min-width: ${minWidth}px"]`);
        maxContentWidth = Math.max(maxContentWidth, minWidth);
      }
    }

    if (maxWidthMatch) {
      const maxWidth = parseInt(maxWidthMatch[1], 10);
      maxContentWidth = Math.max(maxContentWidth, Math.min(maxWidth, evidence.viewportWidth));
    }
  });

  $("img[width]").each((_, element) => {
    const $el = $(element);
    const width = parseInt($el.attr("width") || "0", 10);
    const style = $el.attr("style") || "";

    if (width > evidence.viewportWidth && !style.includes("max-width")) {
      overflowElements.push(`img[width="${width}"]`);
      maxContentWidth = Math.max(maxContentWidth, width);
    }
  });

  $("table").each((_, element) => {
    const $table = $(element);
    const columnCount = $table.find("tr").first().find("td, th").length;

    if (columnCount > 4) {
      overflowElements.push(`table with ${columnCount} columns`);
    }
  });

  $("pre").each((_, element) => {
    const $el = $(element);
    const text = $el.text();
    const longestLine = Math.max(...text.split("\n").map((line) => line.length));

    if (longestLine > 50) {
      overflowElements.push("pre with long lines");
    }
  });

  const hasHorizontalScroll = overflowElements.length > 0;
  const contentWidth = maxContentWidth > 0 ? maxContentWidth : evidence.viewportWidth;

  return {
    viewportWidth: evidence.viewportWidth,
    contentWidth,
    hasHorizontalScroll,
    overflowElements,
  };
}
