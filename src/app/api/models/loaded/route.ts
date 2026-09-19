import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const serverUrl =
    searchParams.get('serverUrl') ||
    'http://localhost:8000/v1/chat/completions';
  const endpoint = serverUrl.replace(
    /\/chat\/completions\/?$/,
    '/models/loaded',
  );

  try {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(await res.text());
    return NextResponse.json(await res.json());
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
