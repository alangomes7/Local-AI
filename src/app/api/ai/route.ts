import { NextResponse } from 'next/server';
import { scheduleSttModelUnload } from '../audio/sttModelLifecycle';

export const runtime = 'nodejs';

function modelEndpoint(serverUrl: string, path: string): string {
  return serverUrl
    .replace(/\/v1\/chat\/completions\/?$/, path)
    .replace(/\/chat\/completions\/?$/, path);
}

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
     * File & Audio voice message processing
     * ------------------------------------------------------------
     */

    const isAudio =
      formData.get('isAudio') === 'true' ||
      (file !== null &&
        (file.type.startsWith('audio/') ||
          file.name.endsWith('.webm') ||
          file.name.endsWith('.wav') ||
          file.name.endsWith('.mp3') ||
          file.name.endsWith('.ogg')));
    let fileContext = '';
    let transcriptionText = '';

    if (file) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const ext = (file.name.split('.').pop() || '').toLowerCase();

        if (isAudio) {
          // Attempt to transcribe the voice message using the inference server's audio transcription endpoint
          try {
            const transcribeEndpoint = apiEndpoint.replace(
              /\/chat\/completions\/?$/,
              '/audio/transcriptions',
            );

            const audioForm = new FormData();
            const audioBlob = new Blob([buffer], {
              type: file.type || 'audio/webm',
            });
            audioForm.append('file', audioBlob, file.name);
            audioForm.append(
              'model',
              process.env.AI_STT_MODEL || 'nvidia/parakeet-tdt-0.6b-v3',
            );
            const sttModel =
              process.env.AI_STT_MODEL || 'nvidia/parakeet-tdt-0.6b-v3';
            const loadResponse = await fetch(
              modelEndpoint(apiEndpoint, '/load_model'),
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: sttModel }),
                cache: 'no-store',
              },
            );
            if (!loadResponse.ok) {
              throw new Error(
                `STT model load failed: ${await loadResponse.text()}`,
              );
            }
            scheduleSttModelUnload(apiEndpoint, sttModel);

            const tHeaders: HeadersInit = {};
            const apiKey = process.env.AI_API_KEY?.trim();
            if (apiKey) {
              tHeaders.Authorization = `Bearer ${apiKey}`;
            }

            const tRes = await fetch(transcribeEndpoint, {
              method: 'POST',
              body: audioForm,
              headers: tHeaders,
              cache: 'no-store',
            });

            if (tRes.ok) {
              const tData = await tRes.json();
              if (tData.text) {
                transcriptionText = String(tData.text).trim();
              }
            }
            scheduleSttModelUnload(apiEndpoint, sttModel);
          } catch (tError) {
            console.log(
              'Transcription service not available or error:',
              tError,
            );
          }

          if (!transcriptionText) {
            throw new Error(
              'Voice transcription returned no text; the chat model was not called.',
            );
          }
          fileContext = `\n\n[User Voice Message Transcript]\n${transcriptionText}\n`;
        } else {
          // Handle all kinds of files (text, code, documents, images, binaries)
          const textExtensions = [
            'txt',
            'md',
            'markdown',
            'json',
            'csv',
            'tsv',
            'js',
            'jsx',
            'ts',
            'tsx',
            'mjs',
            'cjs',
            'html',
            'htm',
            'css',
            'scss',
            'less',
            'py',
            'c',
            'cpp',
            'h',
            'hpp',
            'cc',
            'cxx',
            'cs',
            'java',
            'go',
            'rs',
            'php',
            'rb',
            'sh',
            'bash',
            'zsh',
            'bat',
            'cmd',
            'ps1',
            'sql',
            'xml',
            'yaml',
            'yml',
            'toml',
            'ini',
            'env',
            'log',
            'svg',
            'dockerfile',
            'conf',
            'properties',
            'gradle',
            'swift',
            'kt',
            'kts',
            'r',
            'lua',
            'dart',
            'scala',
          ];

          const sample = buffer.subarray(0, Math.min(buffer.length, 1024));
          const isText = textExtensions.includes(ext) || !sample.includes(0);

          if (isText) {
            let text = buffer.toString('utf-8');
            const MAX_CHARS = 120000;
            if (text.length > MAX_CHARS) {
              text =
                text.slice(0, MAX_CHARS) +
                `\n\n... [Content truncated: ${file.name} is ${(file.size / 1024).toFixed(1)} KB]`;
            }
            fileContext = `\n\n--- Attached File: ${file.name} (${(file.size / 1024).toFixed(1)} KB) ---\n\`\`\`${ext}\n${text}\n\`\`\`\n`;
          } else if (file.type.startsWith('image/')) {
            fileContext = `\n\n--- Attached Image File: ${file.name} (${file.type}, ${(file.size / 1024).toFixed(1)} KB) ---\n`;
          } else {
            fileContext = `\n\n--- Attached File: ${file.name} (${file.type || 'binary/data'}, ${(file.size / 1024).toFixed(1)} KB) ---\n[Binary file attached]\n`;
          }
        }
      } catch (error) {
        console.error('Could not read attached file:', error);

        return NextResponse.json(
          {
            error: `Could not process attached file: ${file.name}`,
          },
          {
            status: 400,
          },
        );
      }
    }

    /*
     * ------------------------------------------------------------
     * Prompt
     * ------------------------------------------------------------
     */

    const rawHistory = formData.get('history') as string | null;
    const history = rawHistory ? JSON.parse(rawHistory) : [];

    let systemPrompt =
      'You are a helpful AI assistant. Answer the user based on their prompt and any provided file context. You support rich formatting including bold (*bold* or **bold**), italic (_italic_), strikethrough (~strikethrough~ or ~~strikethrough~~), underline (<u>underline</u> or __underline__), emojis, bullet points, blockquotes, tables, and standard markdown code blocks with language identifiers (e.g. ```cpp, ```python, etc.).';

    if (!enableThinking) {
      systemPrompt +=
        ' IMPORTANT DIRECTIVE: You must answer directly. Do NOT include any internal reasoning, thinking process, or <think> tags in your response. Output only the final answer.';
    }

    let userPrompt = prompt;
    if (!userPrompt && file) {
      if (isAudio) {
        userPrompt = transcriptionText;
      } else {
        userPrompt = `Please review and analyze the attached file: ${file.name}`;
      }
    }

    const combinedPrompt =
      isAudio && !prompt ? transcriptionText : `${userPrompt}${fileContext}`;

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
    } catch (error: unknown) {
      console.error('Could not connect to AI server:', error);

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
        ? `Could not connect to AI inference server at ${apiEndpoint}. Ensure the server is online and reachable.`
        : error instanceof Error
          ? error.message
          : 'Unknown connection error';

      return NextResponse.json(
        {
          error: message,
          details: fetchError.message,
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

      console.error('Inference server error:', {
        status: upstreamRes.status,
        statusText: upstreamRes.statusText,
        body: errorText,
      });

      let cleanError = `Inference server error (${upstreamRes.status})`;
      try {
        const parsed = JSON.parse(errorText);
        cleanError =
          parsed.error?.message ||
          parsed.error ||
          parsed.detail ||
          parsed.message ||
          cleanError;
      } catch {
        cleanError = errorText || cleanError;
      }

      return NextResponse.json(
        {
          error: cleanError,
          details: errorText,
        },
        {
          status: upstreamRes.status,
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
