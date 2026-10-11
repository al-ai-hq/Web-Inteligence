import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const createDraftSchema = z.object({
  brief_id: z.string().uuid(),
  project_id: z.string().uuid(),
  title_en: z.string().min(1),
  title_ar: z.string().optional(),
  content_en: z.string().min(1),
  content_ar: z.string().optional(),
  author: z.string().min(1),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const parsed = createDraftSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json({ id: crypto.randomUUID(), ...parsed.data, status: 'draft', created_at: new Date().toISOString() }, { status: 201 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const projectId = new URL(request.url).searchParams.get('project_id');
  if (!projectId) return NextResponse.json({ error: 'project_id_required' }, { status: 400 });
  return NextResponse.json({ project_id: projectId, drafts: [] });
}
