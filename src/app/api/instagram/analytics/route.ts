import { NextRequest, NextResponse } from 'next/server';
import { instagramService } from '@/lib/services/instagramService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountFilter = searchParams.get('account') || undefined;
    const shouldSync = searchParams.get('sync') === 'true';

    const data = await instagramService.getAnalyticsSummary(accountFilter, shouldSync);
    return NextResponse.json({ success: true, ...data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const accountFilter = body.account || undefined;

    const result = await instagramService.syncLiveAccountAnalytics(accountFilter);
    const summary = await instagramService.getAnalyticsSummary(accountFilter, false);

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
