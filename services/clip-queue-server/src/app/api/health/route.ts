import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'clip-queue-server',
    timestamp: new Date().toISOString(),
  });
}

