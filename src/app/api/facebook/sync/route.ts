import { NextResponse } from 'next/server';
import { facebookService } from '@/lib/services/facebookService';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const accounts = await facebookService.syncAccounts();
    return NextResponse.json({ success: true, count: accounts.length, accounts });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function GET() {
  try {
    const accounts = await facebookService.syncAccounts();
    return NextResponse.json({ success: true, count: accounts.length, accounts });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

