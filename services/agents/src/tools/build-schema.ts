import { z } from 'zod';
import type { Tool, ToolContext, ToolResult } from './types.js';

const inputSchema = z.object({
  schema_type: z.enum(['Article', 'Product', 'LocalBusiness', 'FAQPage', 'HowTo', 'BreadcrumbList']),
  data: z.record(z.unknown()),
  project_id: z.string(),
});

export function createBuildSchemaTool(): Tool {
  return {
    name: 'build_schema',
    description: 'Builds and validates JSON-LD schema from type and data.',
    inputSchema: {
      type: 'object',
      properties: {
        schema_type: { type: 'string', enum: ['Article', 'Product', 'LocalBusiness', 'FAQPage', 'HowTo', 'BreadcrumbList'] },
        data: { type: 'object' },
        project_id: { type: 'string' },
      },
      required: ['schema_type', 'data', 'project_id'],
    },
    async execute(input: unknown, _context: ToolContext): Promise<ToolResult> {
      const { schema_type, data, project_id } = inputSchema.parse(input);
      const { buildSchema, validateSchema } = await import('@wpi/schema-builder');
      const schema = buildSchema(schema_type, data);
      const validation = validateSchema(schema.json_ld);
      return {
        data: { schema, validation, project_id },
        source_tier: 'first_party',
        limitations: validation.valid ? [] : ['Schema validation errors found'],
      };
    },
  };
}
