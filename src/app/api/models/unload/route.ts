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
      return NextResponse.json(
        { error: `Inference server failed to unload: ${errorText}` },
        { status: response.status },
      );
    }

    return NextResponse.json({ success: true, model });
  } catch (error) {
    console.error('Unload API error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error during model unload.' },
      { status: 500 },
    );
  }
}
