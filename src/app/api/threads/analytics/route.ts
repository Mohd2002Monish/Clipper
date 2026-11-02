import { NextRequest, NextResponse } from 'next/server';
import { threadsService } from '@/lib/services/threadsService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('account') || undefined;
    const shouldSync = searchParams.get('sync') === 'true';

    const summary = await threadsService.getAnalyticsSummary(accountId, shouldSync);
    return NextResponse.json({ success: true, ...summary });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const accountId = body.account || undefined;

    const result = await threadsService.syncLiveAccountAnalytics(accountId);
    const summary = await threadsService.getAnalyticsSummary(accountId, false);

    return NextResponse.json({
      success: true,
      syncResult: result,
      ...summary,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
