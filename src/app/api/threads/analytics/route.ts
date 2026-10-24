import { NextRequest, NextResponse } from 'next/server';
import { threadsService } from '@/lib/services/threadsService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('account') || undefined;
    const summary = await threadsService.getAnalyticsSummary(accountId);
    return NextResponse.json({ success: true, ...summary });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
