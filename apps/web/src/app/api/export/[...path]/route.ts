import { NextResponse } from "next/server";

function deny(): NextResponse {
  return NextResponse.json({ error: "export_denied" }, { status: 403 });
}

export async function GET(): Promise<NextResponse> {
  return deny();
}

export async function POST(): Promise<NextResponse> {
  return deny();
}

export async function PUT(): Promise<NextResponse> {
  return deny();
}

export async function PATCH(): Promise<NextResponse> {
  return deny();
}

export async function DELETE(): Promise<NextResponse> {
  return deny();
}
