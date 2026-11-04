import { NextResponse } from 'next/server';
import { vaultLeadService } from '@/lib/services/vaultLeadService';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await vaultLeadService.scanForVaultComments();
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

