import { NextResponse } from 'next/server';
import { scheduleSttModelUnload } from '../sttModelLifecycle';

export const runtime = 'nodejs';

const DEFAULT_STT_MODEL = 'nvidia/parakeet-tdt-0.6b-v3';

function modelEndpoint(serverUrl: string, path: string): string {
  return serverUrl
    .replace(/\/v1\/chat\/completions\/?$/, path)
    .replace(/\/chat\/completions\/?$/, path);
}

export async function POST(req: Request) {
  let serverUrl = 'http://localhost:8000/v1/chat/completions';
  let model = process.env.AI_STT_MODEL || DEFAULT_STT_MODEL;

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    serverUrl = String(formData.get('serverUrl') || serverUrl);
    model = String(formData.get('model') || model);

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'An audio file is required.' },
        { status: 400 },
      );
    }

    const loadResponse = await fetch(modelEndpoint(serverUrl, '/load_model'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
      cache: 'no-store',
    });
    if (!loadResponse.ok) {
      throw new Error(`STT model load failed: ${await loadResponse.text()}`);
    }
    scheduleSttModelUnload(serverUrl, model);

    const audioForm = new FormData();
    audioForm.append(
      'file',
      new Blob([await file.arrayBuffer()], {
        type: file.type || 'audio/webm',
      }),
      file.name,
    );
    audioForm.append('model', model);
    audioForm.append('language', String(formData.get('language') || 'auto'));

    const response = await fetch(
      modelEndpoint(serverUrl, '/v1/audio/transcriptions'),
      { method: 'POST', body: audioForm, cache: 'no-store' },
    );
    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(
        responseText || `STT failed with HTTP ${response.status}`,
      );
    }

    const result = JSON.parse(responseText) as { text?: string };
    const text = result.text?.trim() || '';
    if (!text) throw new Error('The transcription model returned no text.');
    scheduleSttModelUnload(serverUrl, model);
    return NextResponse.json({ text, model });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Transcription failed.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
