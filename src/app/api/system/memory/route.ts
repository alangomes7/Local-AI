import { NextResponse } from 'next/server';
import os from 'os';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const serverUrl =
    searchParams.get('serverUrl') ||
    'http://localhost:8000/v1/chat/completions';
  const endpoint = serverUrl.replace(
    /\/chat\/completions\/?$/,
    '/system/memory',
  );

  try {
    const res = await fetch(endpoint, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch {
    // Fall back to local OS memory
  }

  const total = os.totalmem();
  const free = os.freemem();
  const used = Math.max(total - free, 0);

  return NextResponse.json({
    primary_device: 'ram',
    total_bytes: total,
    used_bytes: used,
    available_bytes: free,
    percentage: total > 0 ? Number(((used / total) * 100).toFixed(1)) : 0,
    total_human: `${(total / 1024 ** 3).toFixed(2)} GB`,
    used_human: `${(used / 1024 ** 3).toFixed(2)} GB`,
    available_human: `${(free / 1024 ** 3).toFixed(2)} GB`,
    system_ram: {
      total_bytes: total,
      used_bytes: used,
      available_bytes: free,
      percentage: total > 0 ? Number(((used / total) * 100).toFixed(1)) : 0,
      total_human: `${(total / 1024 ** 3).toFixed(2)} GB`,
      used_human: `${(used / 1024 ** 3).toFixed(2)} GB`,
      available_human: `${(free / 1024 ** 3).toFixed(2)} GB`,
    },
    gpu: null,
  });
}
