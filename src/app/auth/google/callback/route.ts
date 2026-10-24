import { NextRequest, NextResponse } from 'next/server';
import { driveService } from '@/lib/services/driveService';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      logger.drive('error', 'OAUTH_REDIRECT_ERROR', `OAuth access denied by user: ${error}`);
      return NextResponse.redirect(new URL('/?tab=settings&driveError=' + encodeURIComponent(error), req.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/?tab=settings&driveError=missing_code', req.url));
    }

    const state = searchParams.get('state');

    // Handle YouTube Multi-Account OAuth Flow
    if (state && state.includes('youtube')) {
      try {
        const { youtubeService } = await import('@/lib/services/youtubeService');
        const account = await youtubeService.handleOAuthCallback(code);
        logger.system('info', 'YOUTUBE_OAUTH_SUCCESS', `Successfully connected YouTube Channel: ${account.channelTitle}`);
        return NextResponse.redirect(new URL('/?tab=youtube&youtube=connected&channel=' + encodeURIComponent(account.channelTitle), req.url));
      } catch (ytErr: unknown) {
        const ytMsg = ytErr instanceof Error ? ytErr.message : String(ytErr);
        logger.system('error', 'YOUTUBE_OAUTH_FAILED', ytMsg);
        return NextResponse.redirect(new URL('/?tab=youtube&youtubeError=' + encodeURIComponent(ytMsg), req.url));
      }
    }

    const { email } = await driveService.handleOAuthCallback(code);
    logger.drive('info', 'OAUTH_FLOW_COMPLETE', `Successfully connected Drive for user: ${email || 'unknown'}`);

    return NextResponse.redirect(new URL('/?tab=settings&drive=connected', req.url));
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.drive('error', 'OAUTH_CALLBACK_EXCEPTION', errorMsg);
    return NextResponse.redirect(new URL('/?tab=settings&driveError=' + encodeURIComponent(errorMsg), req.url));
  }
}
