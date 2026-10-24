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

    const { email } = await driveService.handleOAuthCallback(code);
    logger.drive('info', 'OAUTH_FLOW_COMPLETE', `Successfully connected Drive for user: ${email || 'unknown'}`);

    return NextResponse.redirect(new URL('/?tab=settings&drive=connected', req.url));
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.drive('error', 'OAUTH_CALLBACK_EXCEPTION', errorMsg);
    return NextResponse.redirect(new URL('/?tab=settings&driveError=' + encodeURIComponent(errorMsg), req.url));
  }
}
