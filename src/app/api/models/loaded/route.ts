import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const serverUrl =
    searchParams.get('serverUrl') ||
    'http://localhost:8000/v1/chat/completions';

  let endpoint = serverUrl;
  if (endpoint.includes('/chat/completions')) {
    endpoint = endpoint.replace(/\/chat\/completions\/?$/, '/models/loaded');
  } else if (endpoint.endsWith('/')) {
    endpoint = `${endpoint}v1/models/loaded`;
  } else {
    endpoint = `${endpoint}/v1/models/loaded`;
  }

  try {
    const res = await fetch(endpoint, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control':
          'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}
