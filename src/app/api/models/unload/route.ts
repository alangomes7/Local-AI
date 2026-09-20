import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { model, serverUrl } = await req.json();

    if (!model) {
      return NextResponse.json(
        { error: 'Model name is required for unloading.' },
        { status: 400 },
      );
    }

    const endpoint =
      serverUrl ||
      process.env.AI_INFERENCE_ENDPOINT ||
      'http://localhost:8000/v1/chat/completions';

    // Transform /v1/chat/completions into /v1/models/unload
    const unloadUrl = endpoint.replace(
      /\/chat\/completions\/?$/,
      '/models/unload',
    );

    console.log(`Attempting to unload model: ${model} via ${unloadUrl}`);

    const response = await fetch(unloadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(errorText);
        errorMsg = parsed.error || parsed.detail || parsed.message || errorMsg;
      } catch {
        errorMsg = errorText || errorMsg;
      }

      return NextResponse.json(
        { error: `Failed to unload model: ${errorMsg}` },
        { status: response.status },
      );
    }

    return NextResponse.json({ success: true, model });
  } catch (error: any) {
    console.error('Unload API error:', error);
    const isConnRefused =
      error?.code === 'ECONNREFUSED' ||
      error?.message?.includes('fetch failed') ||
      error?.cause?.code === 'ECONNREFUSED';

    const message = isConnRefused
      ? 'Could not connect to inference server. Ensure the local AI server is running and accessible.'
      : error instanceof Error
        ? error.message
        : 'Error during model unload.';

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
