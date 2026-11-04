import { NextResponse } from 'next/server';
import { vaultLeadService } from '@/lib/services/vaultLeadService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const csvData = await vaultLeadService.exportLeadsToCsv();
    return new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="movie_vault_leads_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

