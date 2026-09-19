import { NextResponse } from 'next/server';
import os from 'os';

export const runtime = 'nodejs';

export async function GET() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;

  return NextResponse.json({
    total: (total / 1024 ** 3).toFixed(2),
    used: (used / 1024 ** 3).toFixed(2),
    percentage: ((used / total) * 100).toFixed(1),
  });
}
