import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const { model, serverUrl } = await req.json();
    const endpoint =
      serverUrl ||
      process.env.AI_INFERENCE_ENDPOINT ||
      'http://localhost:8000/v1/chat/completions';

    let loadUrl = endpoint;
    if (loadUrl.includes('/chat/completions')) {
      loadUrl = loadUrl
        .replace(/\/v1\/chat\/completions\/?$/, '/load_model')
        .replace(/\/chat\/completions\/?$/, '/load_model');
    } else if (loadUrl.endsWith('/')) {
      loadUrl = `${loadUrl}load_model`;
    } else {
      loadUrl = `${loadUrl}/load_model`;
    }

    const response = await fetch(loadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
