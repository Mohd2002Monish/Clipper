import { NextRequest, NextResponse } from 'next/server';
import { instagramService } from '@/lib/services/instagramService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountFilter = searchParams.get('account') || undefined;

    const data = await instagramService.getAnalyticsSummary(accountFilter);
    return NextResponse.json({ success: true, ...data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
