import { NextRequest, NextResponse } from 'next/server';
import { instagramService } from '@/lib/services/instagramService';
import { InstagramAccount } from '@/models/InstagramAccount';
import { connectMongo } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const success = await instagramService.deleteAccount(params.id);
    if (!success) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Instagram account disconnected successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectMongo();
    const body = await req.json();
    const updated = await InstagramAccount.findByIdAndUpdate(params.id, { $set: body }, { new: true });
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, account: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const action = body.action;

    if (action === 'refresh') {
      const result = await instagramService.refreshAccountToken(params.id);
      return NextResponse.json(result);
    } else if (action === 'sync') {
      const account = await instagramService.verifyAndSyncAccount(params.id);
      return NextResponse.json({ success: true, account, message: 'Account profile synced successfully' });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
