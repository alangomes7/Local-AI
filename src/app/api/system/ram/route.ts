import { NextResponse } from 'next/server';
import os from 'os';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const serverUrl = searchParams.get('serverUrl');

  // If serverUrl is provided, try to fetch live memory status from the AI server
  if (serverUrl) {
    try {
      const endpoint = serverUrl.replace(
        /\/chat\/completions\/?$/,
        '/system/memory',
      );
      const res = await fetch(endpoint, { cache: 'no-store' });
      if (res.ok) {
        const serverData = await res.json();
        return NextResponse.json({
          ...serverData,
          from_inference_server: true,
        });
      }
    } catch {
      // Fallback to local host RAM metrics below
    }
  }

  const total = os.totalmem();
  const free = os.freemem();
  const used = Math.max(total - free, 0);

  return NextResponse.json({
    from_inference_server: false,
    primary_device: 'ram',
    total: (total / 1024 ** 3).toFixed(2),
    used: (used / 1024 ** 3).toFixed(2),
    available: (free / 1024 ** 3).toFixed(2),
    free: (free / 1024 ** 3).toFixed(2),
    percentage: total > 0 ? ((used / total) * 100).toFixed(1) : '0',
    availablePercentage: total > 0 ? ((free / total) * 100).toFixed(1) : '100',
    total_bytes: total,
    used_bytes: used,
    available_bytes: free,
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
  });
}
