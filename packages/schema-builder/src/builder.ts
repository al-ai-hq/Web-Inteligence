import type { SchemaResult } from "./types.js";

const REQUIRED_PROPERTIES: Record<string, string[]> = {
  Article: ["headline", "author", "datePublished"],
  FAQPage: ["mainEntity"],
  Product: ["name"],
  LocalBusiness: ["name", "address"],
};

export function buildSchema(type: string, data: Record<string, unknown>): SchemaResult {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": type,
    ...data,
  };

  const required = REQUIRED_PROPERTIES[type] ?? [];
  const errors = required
    .filter((prop) => !(prop in data))
    .map((p) => `Missing required property: ${p}`);

  return {
    json_ld: jsonLd,
    html_snippet: `<script type="application/ld+json">${JSON.stringify(jsonLd, null, 2)}</script>`,
    validation_errors: errors,
  };
}
