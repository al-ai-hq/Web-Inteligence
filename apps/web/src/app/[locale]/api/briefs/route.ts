import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const createSchema = z.object({
  project_id: z.string().uuid(),
  primary_keyword: z.string().min(1),
  intent: z.enum(['informational', 'transactional', 'navigational']),
  audience: z.string().min(1),
  page_goal: z.string().min(1),
  cluster_id: z.string().uuid().optional(),
  target_url: z.string().url().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 });
  const brief = { id: crypto.randomUUID(), ...parsed.data, status: 'draft', created_at: new Date().toISOString() };
  return NextResponse.json(brief, { status: 201 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const projectId = new URL(request.url).searchParams.get('project_id');
  if (!projectId) return NextResponse.json({ error: 'project_id_required' }, { status: 400 });
  return NextResponse.json({ project_id: projectId, briefs: [] });
}
