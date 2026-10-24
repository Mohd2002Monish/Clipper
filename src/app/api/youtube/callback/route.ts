import { NextRequest, NextResponse } from 'next/server';
import { youtubeService } from '@/lib/services/youtubeService';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      logger.system('error', 'YOUTUBE_OAUTH_DENIED', `OAuth access denied: ${error}`);
      return NextResponse.redirect(new URL('/?tab=youtube&youtubeError=' + encodeURIComponent(error), req.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/?tab=youtube&youtubeError=missing_code', req.url));
    }

    const account = await youtubeService.handleOAuthCallback(code);
    return NextResponse.redirect(
      new URL('/?tab=youtube&youtube=connected&channel=' + encodeURIComponent(account.channelTitle), req.url)
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.system('error', 'YOUTUBE_CALLBACK_ERROR', errorMsg);
    return NextResponse.redirect(new URL('/?tab=youtube&youtubeError=' + encodeURIComponent(errorMsg), req.url));
  }
}
