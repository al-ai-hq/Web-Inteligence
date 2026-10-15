import * as cheerio from "cheerio";
import type { EvidencePackage, LanguageAlternate, LanguageSwitch } from "./types.js";

export function extractLanguageSwitch(evidence: EvidencePackage): LanguageSwitch {
  const $ = cheerio.load(evidence.html);
  const alternates: LanguageAlternate[] = [];

  $('link[rel="alternate"][hreflang]').each((_, element) => {
    const $el = $(element);
    const hreflang = $el.attr("hreflang") || "";
    const href = $el.attr("href") || "";

    if (hreflang && href) {
      alternates.push({ hreflang, href });
    }
  });

  const supportedLanguages = alternates.map((a) => a.hreflang);
  const hasVisibleSwitcher = detectVisibleSwitcher($);

  return {
    alternates,
    hasVisibleSwitcher,
    supportedLanguages,
  };
}

function detectVisibleSwitcher($: cheerio.CheerioAPI): boolean {
  const selectors = [
    '[class*="language-switcher" i]',
    '[class*="language-selector" i]',
    '[class*="lang-switch" i]',
    '[class*="lang-selector" i]',
    '[id*="language-switcher" i]',
    '[id*="language-selector" i]',
    '[id*="lang-switch" i]',
    '[id*="lang-selector" i]',
    "[data-language-selector]",
    "[data-language-switcher]",
    '[role*="language-switcher" i]',
    '[role*="language-selector" i]',
  ];

  return selectors.some((selector) => $(selector).length > 0);
}
