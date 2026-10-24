import { NextRequest, NextResponse } from 'next/server';
import { youtubeService } from '@/lib/services/youtubeService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const accounts = await youtubeService.getAccounts();
    return NextResponse.json({ accounts });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channelId');

    if (!channelId) {
      return NextResponse.json({ error: 'channelId is required' }, { status: 400 });
    }

    await youtubeService.deleteAccount(channelId);
    return NextResponse.json({ success: true, message: 'Account removed successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { channelId } = body;

    if (!channelId) {
      return NextResponse.json({ error: 'channelId is required' }, { status: 400 });
    }

    await youtubeService.setActiveAccount(channelId);
    return NextResponse.json({ success: true, message: 'Active account updated' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
