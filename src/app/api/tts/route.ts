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
      voices: [
        'af_heart',
        'af_bella',
        'af_nicole',
        'af_sarah',
        'af_sky',
        'af_alloy',
        'af_aoede',
        'af_jessica',
        'af_kore',
        'af_river',
        'am_adam',
        'am_echo',
        'am_eric',
        'am_fenrir',
        'am_liam',
        'am_michael',
        'am_onyx',
        'am_puck',
        'am_santa',
        'bf_alice',
        'bf_emma',
        'bf_isabella',
        'bf_lily',
        'bm_daniel',
        'bm_fable',
        'bm_george',
        'bm_lewis',
        'ef_dora',
        'em_alex',
        'em_santa',
        'ff_siwis',
        'hf_alpha',
        'hf_beta',
        'hm_omega',
        'hm_psi',
        'if_sara',
        'im_nicola',
        'jf_alpha',
        'jf_gongitsune',
        'jf_nezumi',
        'jf_tebukuro',
        'jm_kumo',
        'pf_dora',
        'pm_alex',
        'pm_santa',
        'zf_xiaobei',
        'zf_xiaoni',
        'zf_xiaoxiao',
        'zf_xiaoyi',
        'zm_yunjian',
        'zm_yunxi',
        'zm_yunxia',
        'zm_yunyang',
      ],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { text, language, serverUrl, model, keepLoaded, voice, speed } =
      await req.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Text input is required' },
        { status: 400 },
      );
    }

    const inferenceEndpoint =
      serverUrl || 'http://localhost:8000/v1/chat/completions';
    const selectedModel = model || 'hexgrad/Kokoro-82M';
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
          voice: voice || 'af_heart',
          speed: typeof speed === 'number' ? speed : 1.0,
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
