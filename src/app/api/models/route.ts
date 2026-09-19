import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const endpoint =
      process.env.AI_INFERENCE_ENDPOINT ||
      'http://localhost:8000/v1/chat/completions';

    /*
     * Convert:
     *
     * /v1/chat/completions
     *
     * into:
     *
     * /v1/models
     */
    const modelsUrl = endpoint.replace(
      /\/chat\/completions\/?$/,
      '/models'
    );

    console.log('========================================');
    console.log('MODEL DISCOVERY');
    console.log('Endpoint:', modelsUrl);
    console.log('========================================');

    const response = await fetch(modelsUrl, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        `Transformers /v1/models returned HTTP ${response.status}:`,
        errorText
      );

      return NextResponse.json(
        {
          error: `Transformers server returned HTTP ${response.status}`,
          details: errorText,
        },
        {
          status: response.status,
        }
      );
    }

    const data = await response.json();

    console.log(
      'Available models:',
      data.data?.map((model: { id?: string }) => model.id)
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error('Model discovery error:', error);

    const message =
      error instanceof Error
        ? error.message
        : 'Could not connect to Transformers server';

    return NextResponse.json(
      {
        error: 'Could not connect to Transformers server.',
        details: message,
      },
      {
        status: 502,
      }
    );
  }
}