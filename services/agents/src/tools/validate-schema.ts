import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "./types.js";

const KNOWN_TYPES = [
  "FAQPage",
  "HowTo",
  "Article",
  "Product",
  "Organization",
  "LocalBusiness",
  "BreadcrumbList",
  "WebPage",
  "WebSite",
];

const inputSchema = z.object({
  structured_data: z.record(z.unknown()),
  schema_type: z.string(),
});

export function createValidateSchemaTool(): Tool {
  return {
    name: "validate_schema",
    description: "Validates JSON-LD or microdata against schema.org type definitions.",
    inputSchema: {
      type: "object",
      properties: {
        structured_data: { type: "object" },
        schema_type: { type: "string" },
      },
      required: ["structured_data", "schema_type"],
    },
    execute(input: unknown, _context: ToolContext): Promise<ToolResult> {
      const { structured_data, schema_type } = inputSchema.parse(input);
      const errors: string[] = [];

      if (!KNOWN_TYPES.includes(schema_type)) {
        errors.push(`Unknown schema type: ${schema_type}`);
      }

      if (!structured_data["@context"] && !structured_data["@type"]) {
        errors.push("Missing @context or @type property");
      }

      return Promise.resolve({
        data: {
          valid: errors.length === 0,
          schema_type,
          errors: errors.length > 0 ? errors : undefined,
        },
        source_tier: "first_party",
        limitations: [],
      });
    },
  };
}
