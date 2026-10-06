import * as cheerio from "cheerio";
import type { EvidencePackage, PolicyLink, PolicyLinks } from "./types";

export function extractPolicyLinks(evidence: EvidencePackage): PolicyLinks {
  const $ = cheerio.load(evidence.html);
  const links: PolicyLink[] = [];

  $("a[href]").each((_, element) => {
    const $el = $(element);
    const href = $el.attr("href") || "";
    const text = $el.text().trim();

    const policyType = classifyPolicyLink(href, text);
    if (policyType) {
      links.push({ type: policyType, href, text: text || undefined });
    }
  });

  const hasPrivacy = links.some((l) => l.type === "privacy");
  const hasTerms = links.some((l) => l.type === "terms");
  const hasPricing = links.some((l) => l.type === "pricing");
  const hasDelivery = links.some((l) => l.type === "delivery");
  const hasReturns = links.some((l) => l.type === "returns");

  return {
    links,
    hasPrivacy,
    hasTerms,
    hasPricing,
    hasDelivery,
    hasReturns,
    totalLinks: links.length,
  };
}

function classifyPolicyLink(
  href: string,
  text: string
): PolicyLink["type"] | null {
  const lowerHref = href.toLowerCase();
  const lowerText = text.toLowerCase();

  if (matchesPolicy(lowerHref, lowerText, ["privacy", "data protection", "gdpr"])) {
    return "privacy";
  }

  if (matchesPolicy(lowerHref, lowerText, ["terms", "conditions", "legal", "user agreement"])) {
    return "terms";
  }

  if (matchesPolicy(lowerHref, lowerText, ["pricing", "price", "cost", "fee"])) {
    return "pricing";
  }

  if (matchesPolicy(lowerHref, lowerText, ["delivery", "shipping", "shipment"])) {
    return "delivery";
  }

  if (matchesPolicy(lowerHref, lowerText, ["return", "refund", "exchange"])) {
    return "returns";
  }

  if (matchesPolicy(lowerHref, lowerText, ["cookie"])) {
    return "cookies";
  }

  return null;
}

function matchesPolicy(
  href: string,
  text: string,
  keywords: string[]
): boolean {
  return (
    keywords.some((keyword) => href.includes(keyword)) ||
    keywords.some((keyword) => text.includes(keyword))
  );
}
