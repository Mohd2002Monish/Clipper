import { NextRequest, NextResponse } from 'next/server';
import { instagramService } from '@/lib/services/instagramService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const accounts = await instagramService.getAccounts();
    return NextResponse.json({ success: true, accounts });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action;

    if (action === 'token') {
      const account = await instagramService.connectAccountWithToken(body.accessToken);
      return NextResponse.json({ success: true, account });
    } else if (action === 'custom') {
      const account = await instagramService.addCustomAccount({
        username: body.username,
        displayName: body.displayName,
        biography: body.biography,
        profilePictureUrl: body.profilePictureUrl,
        followerCount: body.followerCount,
        accessToken: body.accessToken,
      });
      return NextResponse.json({ success: true, account });
    }

    return NextResponse.json({ success: false, error: 'Invalid action type' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
