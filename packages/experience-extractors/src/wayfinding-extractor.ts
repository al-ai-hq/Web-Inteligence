import * as cheerio from "cheerio";
import type { EvidencePackage, WayfindingCues } from "./types.js";

export function extractWayfindingCues(evidence: EvidencePackage): WayfindingCues {
  const $ = cheerio.load(evidence.html);

  const pageTitle = $("head title").text().trim() || undefined;
  const hasBreadcrumbs = detectBreadcrumbs($);
  const breadcrumbElements = extractBreadcrumbElements($);
  const hasActiveState = detectActiveState($);
  const hasClearHierarchy = checkHeadingHierarchy($);

  return {
    hasBreadcrumbs,
    breadcrumbElements,
    hasActiveState,
    pageTitle,
    hasClearHierarchy,
  };
}

function detectBreadcrumbs($: cheerio.CheerioAPI): boolean {
  const breadcrumbSelectors = [
    '[class*="breadcrumb" i]',
    '[id*="breadcrumb" i]',
    '[aria-label*="breadcrumb" i]',
    'nav[aria-label*="Breadcrumb" i]',
    '[class*="crumb" i]',
  ];

  return breadcrumbSelectors.some((selector) => $(selector).length > 0);
}

function extractBreadcrumbElements($: cheerio.CheerioAPI): string[] {
  const elements: string[] = [];

  const breadcrumbSelectors = [
    '[class*="breadcrumb" i]',
    '[id*="breadcrumb" i]',
    '[aria-label*="breadcrumb" i]',
  ];

  for (const selector of breadcrumbSelectors) {
    const $breadcrumb = $(selector);
    if ($breadcrumb.length > 0) {
      $breadcrumb.find("a, span").each((_, el) => {
        const text = $(el).text().trim();
        if (text) {
          elements.push(text);
        }
      });
      break;
    }
  }

  return elements;
}

function detectActiveState($: cheerio.CheerioAPI): boolean {
  const activeSelectors = [
    '[class*="active" i]',
    '[class*="current" i]',
    "[aria-current]",
    '[aria-current="page"]',
  ];

  return activeSelectors.some((selector) => {
    const $matches = $(selector);
    return $matches.filter("a, li, nav *").length > 0;
  });
}

function checkHeadingHierarchy($: cheerio.CheerioAPI): boolean {
  const headings: number[] = [];

  $("h1, h2, h3, h4, h5, h6").each((_, element) => {
    const tagName = element.tagName.toLowerCase();
    const level = parseInt(tagName.charAt(1), 10);
    headings.push(level);
  });

  if (headings.length === 0) {
    return false;
  }

  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1];
    const current = headings[i];

    if (prev === undefined || current === undefined) {
      continue;
    }

    if (current > prev + 1) {
      return false;
    }
  }

  return true;
}
