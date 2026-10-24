import { NextRequest, NextResponse } from 'next/server';
import { youtubeService } from '@/lib/services/youtubeService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUrl = youtubeService.getAuthUrl();
    return NextResponse.json({ url: authUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
