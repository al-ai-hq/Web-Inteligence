import { describe, it, expect } from 'vitest';
import { createCreateDraftTool } from '../../src/tools/create-draft.js';
import { createBuildSchemaTool } from '../../src/tools/build-schema.js';
import { createManageFactsTool } from '../../src/tools/manage-facts.js';
import { createRequestApprovalTool } from '../../src/tools/request-approval.js';
import type { ToolContext } from '../../src/tools/types.js';

const ctx: ToolContext = { audit_id: 'a-1', project_id: 'p-1', evidence_bucket: 'b' } as ToolContext;

describe('create_draft tool', () => {
  it('creates a draft when gates pass', async () => {
    const tool = createCreateDraftTool();
    const result = await tool.execute({
      brief_id: 'brief-1',
      project_id: 'p-1',
      title_en: 'Test Title',
      content_en: 'Test content',
      author: 'Test Author',
    }, ctx);
    expect(result.source_tier).toBe('first_party');
    const data = result.data as Record<string, unknown>;
    expect(data.draft).toBeDefined();
  });

  it('rejects when draft gates fail', async () => {
    const tool = createCreateDraftTool();
    const result = await tool.execute({
      brief_id: 'brief-1',
      project_id: 'p-1',
      title_en: 'Test',
      content_en: 'Content',
      author: '',
      monthly_draft_count: 10,
    }, ctx);
    const data = result.data as Record<string, unknown>;
    expect(data.error).toBeDefined();
  });
});

describe('build_schema tool', () => {
  it('builds and validates schema', async () => {
    const tool = createBuildSchemaTool();
    const result = await tool.execute({
      schema_type: 'Article',
      data: { headline: 'Test', author: 'Author', datePublished: '2026-01-01' },
      project_id: 'p-1',
    }, ctx);
    expect(result.source_tier).toBe('first_party');
    const data = result.data as Record<string, unknown>;
    expect(data.schema).toBeDefined();
    expect(data.validation).toBeDefined();
  });
});

describe('manage_facts tool', () => {
  it('flags regulated claims', async () => {
    const tool = createManageFactsTool();
    const result = await tool.execute({
      claim_text: 'This treatment can cure diabetes',
    }, ctx);
    const data = result.data as Record<string, unknown>;
    expect(data.requires_review).toBe(true);
    expect(data.topic).toBe('health');
  });

  it('passes non-regulated claims', async () => {
    const tool = createManageFactsTool();
    const result = await tool.execute({
      claim_text: 'We offer consulting services',
    }, ctx);
    const data = result.data as Record<string, unknown>;
    expect(data.requires_review).toBe(false);
  });
});

describe('request_approval tool', () => {
  it('approves tier 1 with one approver', async () => {
    const tool = createRequestApprovalTool();
    const result = await tool.execute({
      risk_tier: 1,
      approvers: [{ user_id: 'u-1', is_requester: false }],
    }, ctx);
    const data = result.data as Record<string, unknown>;
    expect(data.approved).toBe(true);
  });

  it('rejects tier 3 with requester as approver', async () => {
    const tool = createRequestApprovalTool();
    const result = await tool.execute({
      risk_tier: 3,
      approvers: [
        { user_id: 'u-1', is_requester: true },
        { user_id: 'u-2', is_requester: false },
      ],
    }, ctx);
    const data = result.data as Record<string, unknown>;
    expect(data.approved).toBe(false);
  });
});
