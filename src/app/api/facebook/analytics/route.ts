import { NextRequest, NextResponse } from 'next/server';
import { facebookService } from '@/lib/services/facebookService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pageId = searchParams.get('pageId') || searchParams.get('accountId') || undefined;
    const analytics = await facebookService.getAnalytics(pageId);
    return NextResponse.json({ success: true, analytics });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

