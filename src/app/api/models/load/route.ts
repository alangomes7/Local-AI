import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { model, serverUrl } = await req.json();
    const endpoint =
      serverUrl ||
      process.env.AI_INFERENCE_ENDPOINT ||
      'http://localhost:8000/v1/chat/completions';
    const loadUrl = endpoint.replace(
      /\/v1\/chat\/completions\/?$/,
      '/load_model',
    );

    const response = await fetch(loadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    });

    if (!response.ok) throw new Error(await response.text());
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
