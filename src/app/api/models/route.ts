import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientServerUrl = searchParams.get('serverUrl')?.trim();

    const endpoint =
      clientServerUrl ||
      process.env.AI_INFERENCE_ENDPOINT ||
      'http://localhost:8000/v1/chat/completions';

    let modelsUrl = endpoint;
    if (modelsUrl.includes('/chat/completions')) {
      modelsUrl = modelsUrl.replace(/\/chat\/completions\/?$/, '/models');
    } else if (modelsUrl.endsWith('/')) {
      modelsUrl = `${modelsUrl}models`;
    } else {
      modelsUrl = `${modelsUrl}/models`;
    }

    const response = await fetch(modelsUrl, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      let cleanError = `Server returned HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(errorText);
        cleanError =
          parsed.error || parsed.detail || parsed.message || cleanError;
      } catch {
        cleanError = errorText || cleanError;
      }

      console.error(
        `Inference server /models returned HTTP ${response.status}:`,
        errorText,
      );

      return NextResponse.json(
        {
          error: `Inference server error (${response.status}): ${cleanError}`,
          details: errorText,
        },
        {
          status: response.status,
        },
      );
    }

    const data = await response.json();
    if (Array.isArray(data.data)) {
      data.data = data.data.filter((item: any) => {
        const id = String(item?.id || '').toLowerCase();
        return (
          !id.includes('parakeet') &&
          !id.includes('seamless-m4t') &&
          !id.includes('kokoro') &&
          !id.includes('whisper') &&
          !id.includes('silero') &&
          !id.includes('tts') &&
          !id.includes('stt')
        );
      });
      data.data.sort((a: any, b: any) => {
        const idA = String(a?.id || '');
        const idB = String(b?.id || '');
        return idA.localeCompare(idB, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      });
    }
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Model discovery error:', error);

    const isConnRefused =
      error?.code === 'ECONNREFUSED' ||
      error?.message?.includes('fetch failed') ||
      error?.cause?.code === 'ECONNREFUSED';

    const message = isConnRefused
      ? 'Could not connect to inference server. Ensure the local AI server is running and accessible.'
      : error instanceof Error
        ? error.message
        : 'Unknown connection error';

    return NextResponse.json(
      {
        error: message,
        details: error?.message,
      },
      {
        status: 502,
      },
    );
  }
}
