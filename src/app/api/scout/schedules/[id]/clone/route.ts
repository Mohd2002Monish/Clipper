import { NextRequest, NextResponse } from 'next/server';
import { aiVideoScoutService } from '@/lib/services/aiVideoScoutService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const newName = body.name?.trim();

    const cloned = await aiVideoScoutService.cloneSchedule(params.id, newName);
    return NextResponse.json({ success: true, schedule: cloned }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
