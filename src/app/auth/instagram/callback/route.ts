import { NextRequest, NextResponse } from 'next/server';
import { instagramService } from '@/lib/services/instagramService';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error') || searchParams.get('error_description');

    if (error) {
      logger.system('warn', 'INSTAGRAM_OAUTH_DENIED', `User denied Meta Instagram OAuth: ${error}`);
      return NextResponse.redirect(
        new URL(`/?tab=instagram-composer&instagramError=${encodeURIComponent(error)}`, req.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/?tab=instagram-composer&instagramError=missing_authorization_code', req.url)
      );
    }

    const account = await instagramService.handleOAuthCallback(code);
    logger.system('info', 'INSTAGRAM_OAUTH_SUCCESS', `Connected Meta Instagram Account @${account.username}`);

    return NextResponse.redirect(
      new URL(
        `/?tab=instagram-composer&instagramConnected=true&username=${encodeURIComponent(account.username)}`,
        req.url
      )
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.system('error', 'INSTAGRAM_OAUTH_EXCEPTION', errorMsg);
    return NextResponse.redirect(
      new URL(`/?tab=instagram-composer&instagramError=${encodeURIComponent(errorMsg)}`, req.url)
    );
  }
}
