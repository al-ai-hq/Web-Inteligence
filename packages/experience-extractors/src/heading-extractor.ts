import * as cheerio from "cheerio";
import type { EvidencePackage, HeadingStructure, HeadingInfo } from "./types.js";

export function extractHeadingStructure(evidence: EvidencePackage): HeadingStructure {
  const $ = cheerio.load(evidence.html);
  const headings: HeadingInfo[] = [];

  $("h1, h2, h3, h4, h5, h6").each((_, element) => {
    const $el = $(element);
    const tagName = element.tagName.toLowerCase();
    const level = parseInt(tagName.charAt(1), 10);
    const text = $el.text().trim();
    const id = $el.attr("id");

    headings.push({
      level,
      text,
      id: id || undefined,
    });
  });

  const h1Count = headings.filter((h) => h.level === 1).length;
  const primaryHeading = headings.find((h) => h.level === 1)?.text;

  const hasLogicalOrder = checkLogicalOrder(headings);

  return {
    headings,
    h1Count,
    hasLogicalOrder,
    primaryHeading,
  };
}

function checkLogicalOrder(headings: HeadingInfo[]): boolean {
  if (headings.length === 0) return true;

  let previousLevel = 0;
  for (const heading of headings) {
    if (heading.level > previousLevel + 1 && previousLevel > 0) {
      return false;
    }
    previousLevel = heading.level;
  }
  return true;
}
