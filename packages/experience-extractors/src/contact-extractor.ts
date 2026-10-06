import * as cheerio from "cheerio";
import type { ContactLink, ContactLinks, EvidencePackage } from "./types.js";

export function extractContactLinks(evidence: EvidencePackage): ContactLinks {
  const $ = cheerio.load(evidence.html);
  const links: ContactLink[] = [];

  $("a[href]").each((_, element) => {
    const $el = $(element);
    const href = $el.attr("href") || "";
    const text = $el.text().trim();

    const contactType = classifyContactLink(href);
    if (contactType) {
      links.push({ type: contactType, href, text: text || undefined });
    }
  });

  const hasPhone = links.some((l) => l.type === "phone");
  const hasEmail = links.some((l) => l.type === "email");
  const hasMessaging = links.some((l) =>
    ["whatsapp", "telegram", "messenger"].includes(l.type)
  );

  return {
    links,
    hasPhone,
    hasEmail,
    hasMessaging,
    totalLinks: links.length,
  };
}

function classifyContactLink(
  href: string
): ContactLink["type"] | null {
  const lowerHref = href.toLowerCase();

  if (lowerHref.startsWith("tel:")) {
    return "phone";
  }

  if (lowerHref.startsWith("mailto:")) {
    return "email";
  }

  if (
    lowerHref.startsWith("whatsapp://") ||
    lowerHref.includes("wa.me/")
  ) {
    return "whatsapp";
  }

  if (
    lowerHref.startsWith("tg://") ||
    lowerHref.includes("t.me/")
  ) {
    return "telegram";
  }

  if (
    lowerHref.startsWith("fb-messenger://") ||
    lowerHref.includes("m.me/")
  ) {
    return "messenger";
  }

  return null;
}
