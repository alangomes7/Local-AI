import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { serverUrl } = await req.json();
    const endpoint = (
      serverUrl || 'http://localhost:8000/v1/chat/completions'
    ).replace(/\/chat\/completions\/?$/, '/models/unload-all');

    const res = await fetch(endpoint, { method: 'POST' });
    if (!res.ok) {
      const errorText = await res.text();
      let errorMsg = `HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(errorText);
        errorMsg = parsed.error || parsed.detail || parsed.message || errorMsg;
      } catch {
        errorMsg = errorText || errorMsg;
      }
      return NextResponse.json(
        { error: `Failed to unload models: ${errorMsg}` },
        { status: res.status },
      );
    }
    return NextResponse.json(await res.json());
  } catch (error: any) {
    const isConnRefused =
      error?.code === 'ECONNREFUSED' ||
      error?.message?.includes('fetch failed') ||
      error?.cause?.code === 'ECONNREFUSED';

    const message = isConnRefused
      ? 'Could not connect to inference server. Ensure the local AI server is running and accessible.'
      : error?.message || 'Failed to unload models.';

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
