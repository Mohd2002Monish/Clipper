import { NextRequest, NextResponse } from 'next/server';
import { jobService } from '@/lib/services/jobService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await jobService.retryFailedParts(params.id);
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}
