import { NextRequest, NextResponse } from 'next/server';
import { vaultLeadService } from '@/lib/services/vaultLeadService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const platform = searchParams.get('platform') || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    const skip = searchParams.get('skip') ? Number(searchParams.get('skip')) : undefined;

    const data = await vaultLeadService.getLeads({
      status,
      platform,
      search,
      limit,
      skip,
    });

    return NextResponse.json({ success: true, ...data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

