import type { ValidationResult } from "./types.js";

const REQUIRED_PROPERTIES: Record<string, string[]> = {
  Article: ["headline", "author", "datePublished"],
  FAQPage: ["mainEntity"],
  Product: ["name"],
  LocalBusiness: ["name", "address"],
};

export function validateSchema(schema: Record<string, unknown>): ValidationResult {
  const type = schema["@type"] as string | undefined;
  if (!type) {
    return { valid: false, errors: [{ path: "@type", message: "Missing @type" }], warnings: [] };
  }

  const required = REQUIRED_PROPERTIES[type] ?? [];
  const errors = required
    .filter((prop) => !(prop in schema))
    .map((prop) => ({ path: prop, message: `Missing required property: ${prop}` }));

  return { valid: errors.length === 0, errors, warnings: [] };
}
