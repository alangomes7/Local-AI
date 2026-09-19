import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    /*
     * ------------------------------------------------------------
     * Read request
     * ------------------------------------------------------------
     */

    const formData = await req.formData();
    const prompt = String(formData.get('prompt') || '').trim();
    const clientServerUrl = String(formData.get('serverUrl') || '').trim();
    const clientModel = String(formData.get('model') || '').trim();
    const enableThinking = formData.get('enableThinking') !== 'false';
    const file = formData.get('file') as File | null;

    /*
     * ------------------------------------------------------------
     * Validate
     * ------------------------------------------------------------
     */

    if (!prompt && !file) {
      return NextResponse.json(
        {
          error: 'Prompt or file is required.',
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ------------------------------------------------------------
     * File processing
     * ------------------------------------------------------------
     */

    let fileContext = '';

    if (file) {
      try {
        const fileText = await file.text();

        fileContext = `

--- Attached File: ${file.name} ---

\`\`\`
${fileText}
\`\`\`

`;
      } catch (error) {
        console.error('Could not read attached file:', error);

        return NextResponse.json(
          {
            error: `Could not read attached file: ${file.name}`,
          },
          {
            status: 400,
          },
        );
      }
    }

    /*
     * ------------------------------------------------------------
     * Server configuration
     * ------------------------------------------------------------
     */

    const apiEndpoint =
      clientServerUrl ||
      process.env.AI_INFERENCE_ENDPOINT ||
      'http://localhost:8000/v1/chat/completions';

    /*
     * The model is selected from the UI.
     *
     * Environment variable is only a fallback.
     */
    const model = clientModel || process.env.AI_MODEL || '';

    if (!model) {
      return NextResponse.json(
        {
          error: 'No AI model selected.',
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ------------------------------------------------------------
     * Prompt
     * ------------------------------------------------------------
     */

    const rawHistory = formData.get('history') as string | null;
    const history = rawHistory ? JSON.parse(rawHistory) : [];

    let systemPrompt =
      'You are a helpful AI assistant. Answer the user based on their prompt and any provided file context. When writing code, ALWAYS format it inside standard markdown code blocks with the correct language identifier (e.g. ```cpp, ```python, ```javascript, etc.).';

    if (!enableThinking) {
      systemPrompt +=
        ' IMPORTANT DIRECTIVE: You must answer directly. Do NOT include any internal reasoning, thinking process, or <think> tags in your response. Output only the final answer.';
    }

    const combinedPrompt = `${prompt}${fileContext}`;

    /*
     * ------------------------------------------------------------
     * Logging
     * ------------------------------------------------------------
     */

    console.log('========================================');
    console.log('AI REQUEST');
    console.log('Endpoint:', apiEndpoint);
    console.log('Model:', model);
    console.log('Prompt length:', combinedPrompt.length);
    console.log('File:', file?.name || 'none');
    console.log('========================================');

    /*
     * ------------------------------------------------------------
     * Headers
     * ------------------------------------------------------------
     */

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    /*
     * Local Transformers normally does not require
     * an Authorization header.
     *
     * If AI_API_KEY exists, send it.
     */
    const apiKey = process.env.AI_API_KEY?.trim();

    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    /*
     * ------------------------------------------------------------
     * Call Transformers
     * ------------------------------------------------------------
     */

    let upstreamRes: Response;

    try {
      upstreamRes = await fetch(apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          stream: true,
          messages: [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: combinedPrompt },
          ],
        }),
      });
    } catch (error) {
      console.error('Could not connect to AI server:', error);

      const message =
        error instanceof Error ? error.message : 'Unknown connection error';

      return NextResponse.json(
        {
          error: `Could not connect to Transformers server at ${apiEndpoint}`,
          details: message,
        },
        {
          status: 502,
        },
      );
    }

    /*
     * ------------------------------------------------------------
     * Handle upstream error
     * ------------------------------------------------------------
     */

    if (!upstreamRes.ok) {
      const errorText = await upstreamRes.text();

      console.error('Transformers server error:', {
        status: upstreamRes.status,
        statusText: upstreamRes.statusText,
        body: errorText,
      });

      return new NextResponse(
        `Transformers server error (${upstreamRes.status}): ${errorText}`,
        {
          status: upstreamRes.status,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
          },
        },
      );
    }

    /*
     * ------------------------------------------------------------
     * Streaming response
     * ------------------------------------------------------------
     */

    if (!upstreamRes.body) {
      return NextResponse.json(
        {
          error: 'Transformers server returned an empty response body.',
        },
        {
          status: 502,
        },
      );
    }

    return new Response(upstreamRes.body, {
      status: 200,

      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',

        'Cache-Control': 'no-cache, no-transform',

        Connection: 'keep-alive',

        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('API /api/ai error:', error);

    const message =
      error instanceof Error ? error.message : 'Internal Server Error';

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}
