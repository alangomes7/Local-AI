import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { serverUrl } = await req.json();
    const endpoint = (
      serverUrl || 'http://localhost:8000/v1/chat/completions'
    ).replace(/\/chat\/completions\/?$/, '/models/unload-all');

    const res = await fetch(endpoint, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    return NextResponse.json(await res.json());
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
