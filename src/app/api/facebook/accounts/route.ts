import { NextRequest, NextResponse } from 'next/server';
import { facebookService } from '@/lib/services/facebookService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const accounts = await facebookService.getAccounts();
    return NextResponse.json({ success: true, accounts });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || 'custom';

    if (action === 'custom') {
      const account = await facebookService.addCustomAccount({
        pageId: body.pageId || `fb_page_${Date.now()}`,
        pageName: body.pageName || 'Facebook Page',
        category: body.category,
        pictureUrl: body.pictureUrl,
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

