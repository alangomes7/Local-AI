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

    const loadedModelsUrl = endpoint
      .replace(/\/v1\/chat\/completions\/?$/, '/v1/models/loaded')
      .replace(/\/chat\/completions\/?$/, '/v1/models/loaded');

    try {
      const loadedResponse = await fetch(loadedModelsUrl, {
        cache: 'no-store',
      });
      if (loadedResponse.ok) {
        const loadedPayload = (await loadedResponse.json()) as {
          data?: Array<{ id?: string; loaded?: boolean }>;
        };
        const requestedBase = String(model).split('@')[0];
        const loadedModel = loadedPayload.data?.find(
          (entry) =>
            entry.loaded && entry.id?.split('@')[0] === requestedBase,
        );

        if (loadedModel?.id) {
          return NextResponse.json({
            success: true,
            model: loadedModel.id,
            loaded: true,
            message: 'Model is already loaded.',
          });
        }
      }
    } catch {
      // Continue with the explicit load request when status cannot be checked.
    }

    const response = await fetch(loadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `Server returned HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(errorText);
        errorMsg = parsed.error || parsed.detail || parsed.message || errorMsg;
      } catch {
        errorMsg = errorText || errorMsg;
      }
      return NextResponse.json(
        { error: errorMsg },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const fetchError = error as {
      code?: string;
      message?: string;
      cause?: { code?: string };
    };
    const isConnRefused =
      fetchError.code === 'ECONNREFUSED' ||
      fetchError.message?.includes('fetch failed') ||
      fetchError.cause?.code === 'ECONNREFUSED';

    const message = isConnRefused
      ? 'Could not connect to inference server. Ensure the local AI server is running and accessible.'
      : fetchError.message || 'Failed to load model.';

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
