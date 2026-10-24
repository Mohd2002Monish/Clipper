import { NextRequest, NextResponse } from 'next/server';
import { jobService } from '@/lib/services/jobService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const success = await jobService.cancelJob(params.id);
    return NextResponse.json({ success });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}
