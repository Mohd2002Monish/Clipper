import { NextRequest, NextResponse } from 'next/server';
import { aiVideoScoutService } from '@/lib/services/aiVideoScoutService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await aiVideoScoutService.runScheduledTask(params.id);
    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
