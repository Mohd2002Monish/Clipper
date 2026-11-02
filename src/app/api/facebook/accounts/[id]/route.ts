import { NextRequest, NextResponse } from 'next/server';
import { facebookService } from '@/lib/services/facebookService';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const success = await facebookService.deleteAccount(params.id);
    return NextResponse.json({ success });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    if (body.action === 'sync') {
      const account = await facebookService.verifyAndSyncAccount(params.id);
      return NextResponse.json({ success: true, account });
    }

    const updated = await facebookService.updateAccount(params.id, body);
    return NextResponse.json({ success: true, account: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

