import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function modelEndpoint(serverUrl: string, path: string): string {
  return serverUrl
    .replace(/\/v1\/chat\/completions\/?$/, path)
    .replace(/\/chat\/completions\/?$/, path);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const serverUrl =
      searchParams.get('serverUrl') ||
      'http://localhost:8000/v1/chat/completions';
    const voicesEndpoint = modelEndpoint(serverUrl, '/v1/audio/voices');

    try {
      const response = await fetch(voicesEndpoint, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
    } catch {
      // Fall back to default list if server is offline or unreachable
    }

    return NextResponse.json({
      voices: ['de', 'en', 'es', 'fr', 'hi', 'it', 'ja', 'pt', 'zh'],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { text, language, serverUrl, keepLoaded } = await req.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Text input is required' },
        { status: 400 },
      );
    }

    const inferenceEndpoint =
      serverUrl || 'http://localhost:8000/v1/chat/completions';
    const selectedModel = 'facebook/hf-seamless-m4t-medium';
    const loadEndpoint = modelEndpoint(inferenceEndpoint, '/load_model');
    const unloadEndpoint = modelEndpoint(
      inferenceEndpoint,
      '/v1/models/unload',
    );
    const apiEndpoint = modelEndpoint(inferenceEndpoint, '/v1/audio/speech');

    const loadResponse = await fetch(loadEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: selectedModel }),
      cache: 'no-store',
    });
    if (!loadResponse.ok) {
      throw new Error(`TTS model load failed: ${await loadResponse.text()}`);
    }

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: text,
          model: selectedModel,
          language: language || 'en',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`TTS Server Error: ${response.status} - ${errorText}`);
      }

      const audioBuffer = await response.arrayBuffer();

      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/wav',
          'Cache-Control': 'no-store',
        },
      });
    } finally {
      if (!keepLoaded) {
        await fetch(unloadEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: selectedModel }),
          cache: 'no-store',
        }).catch(() => undefined);
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
