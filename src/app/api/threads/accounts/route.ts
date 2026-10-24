import { NextRequest, NextResponse } from 'next/server';
import { threadsService } from '@/lib/services/threadsService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const accounts = await threadsService.getAccounts();
    return NextResponse.json({ success: true, accounts });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // 1. Connect via direct Meta Threads Access Token
    if (action === 'token') {
      if (!body.accessToken) {
        return NextResponse.json({ success: false, error: 'Access token is required' }, { status: 400 });
      }
      const account = await threadsService.connectAccountWithToken(body.accessToken);
      return NextResponse.json({ success: true, account });
    }

    // 2. Add custom / test account (sandbox)
    if (action === 'custom') {
      if (!body.username) {
        return NextResponse.json({ success: false, error: 'Username is required' }, { status: 400 });
      }
      const account = await threadsService.addCustomAccount(body);
      return NextResponse.json({ success: true, account });
    }

    // 3. Update existing account
    const { userId, username, displayName, accessToken, biography, profilePictureUrl, isActive } = body;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    const updated = await threadsService.updateAccount(userId, {
      username,
      displayName,
      accessToken,
      biography,
      profilePictureUrl,
      isActive,
    });

    return NextResponse.json({ success: true, account: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
