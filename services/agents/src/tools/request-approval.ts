import { z } from 'zod';
import type { Tool, ToolContext, ToolResult } from './types.js';

const inputSchema = z.object({
  risk_tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  approvers: z.array(z.object({
    user_id: z.string(),
    is_requester: z.boolean(),
  })),
});

export function createRequestApprovalTool(): Tool {
  return {
    name: 'request_approval',
    description: 'Checks if approval requirements are met for a given risk tier and set of approvers.',
    inputSchema: {
      type: 'object',
      properties: {
        risk_tier: { type: 'number', enum: [1, 2, 3] },
        approvers: { type: 'array', items: { type: 'object' } },
      },
      required: ['risk_tier', 'approvers'],
    },
    async execute(input: unknown, _context: ToolContext): Promise<ToolResult> {
      const data = inputSchema.parse(input);
      const { checkApprovalRequirements } = await import('@wpi/content-approvals');
      const result = checkApprovalRequirements(data.risk_tier, data.approvers);
      return {
        data: { risk_tier: data.risk_tier, approved: result.ok, error: result.error },
        source_tier: 'first_party',
        limitations: result.ok ? [] : [result.error ?? 'Approval requirements not met'],
      };
    },
  };
}
