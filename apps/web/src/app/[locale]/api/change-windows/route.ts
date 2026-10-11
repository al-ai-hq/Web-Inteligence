import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const projectId = new URL(request.url).searchParams.get('project_id');
  if (!projectId) return NextResponse.json({ error: 'project_id_required' }, { status: 400 });
  return NextResponse.json({ project_id: projectId, is_open: true, next_close: null });
}
