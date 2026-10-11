import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const buildSchema = z.object({
  schema_type: z.enum(['Article', 'Product', 'LocalBusiness', 'FAQPage', 'HowTo', 'BreadcrumbList']),
  data: z.record(z.unknown()),
  project_id: z.string().uuid(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const parsed = buildSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json({ id: crypto.randomUUID(), ...parsed.data, status: 'built' }, { status: 201 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const projectId = new URL(request.url).searchParams.get('project_id');
  if (!projectId) return NextResponse.json({ error: 'project_id_required' }, { status: 400 });
  return NextResponse.json({ project_id: projectId, schemas: [] });
}
