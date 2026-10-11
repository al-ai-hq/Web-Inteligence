import { z } from 'zod';

export const ChangeSetItemSchema = z.object({
  id: z.string(),
  change_set_id: z.string(),
  page_url: z.string(),
  field_name: z.string(),
  old_value: z.string().nullable(),
  new_value: z.string(),
  created_at: z.string(),
});

export const ChangeSetSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  description: z.string(),
  risk_tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  status: z.enum(['draft', 'validated', 'previewed', 'approved', 'rejected']),
  created_by: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ApprovalRecordSchema = z.object({
  id: z.string(),
  change_set_id: z.string(),
  risk_tier: z.number(),
  approvers: z.array(z.object({
    user_id: z.string(),
    is_requester: z.boolean(),
  })),
  expires_at: z.string(),
  status: z.enum(['pending', 'approved', 'rejected', 'expired']),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ChangeSet = z.infer<typeof ChangeSetSchema>;
export type ChangeSetItem = z.infer<typeof ChangeSetItemSchema>;
export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;
