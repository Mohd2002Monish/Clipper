import { NextRequest, NextResponse } from 'next/server';
import { instagramService } from '@/lib/services/instagramService';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error =
    searchParams.get('error') ||
    searchParams.get('error_description') ||
    searchParams.get('error_reason');
  const stateFromQuery = searchParams.get('state');
  const storedStateCookie = req.cookies.get('ig_oauth_state')?.value;

  const createRedirect = (url: URL) => {
    const res = NextResponse.redirect(url);
    res.cookies.delete('ig_oauth_state');
    return res;
  };

  try {
    // 1. Check for user denial or Instagram OAuth errors
    if (error) {
      logger.system('warn', 'INSTAGRAM_OAUTH_DENIED', `User denied Instagram OAuth: ${error}`);
      return createRedirect(
        new URL(`/?tab=instagram-composer&instagramError=${encodeURIComponent(error)}`, req.url)
      );
    }

    // 2. CSRF State validation (if state was issued via cookie)
    if (storedStateCookie && stateFromQuery && storedStateCookie !== stateFromQuery) {
      logger.system('error', 'INSTAGRAM_OAUTH_CSRF_FAILED', 'OAuth state verification failed');
      return createRedirect(
        new URL('/?tab=instagram-composer&instagramError=csrf_state_mismatch', req.url)
      );
    }

    // 3. Ensure code exists
    if (!code) {
      return createRedirect(
        new URL('/?tab=instagram-composer&instagramError=missing_authorization_code', req.url)
      );
    }

    // 4. Sanitize authorization code (strip Instagram's documented #_ fragment suffix)
    const sanitizedCode = code.replace(/#_.*$/, '').replace(/#.*$/, '').trim();

    // 5. Complete token exchange, profile retrieval, and account persistence
    const account = await instagramService.handleOAuthCallback(sanitizedCode);
    logger.system('info', 'INSTAGRAM_OAUTH_SUCCESS', `Connected Instagram Account @${account.username}`);

    return createRedirect(
      new URL(
        `/?tab=instagram-composer&instagramConnected=true&username=${encodeURIComponent(account.username)}`,
        req.url
      )
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.system('error', 'INSTAGRAM_OAUTH_EXCEPTION', errorMsg);
    return createRedirect(
      new URL(`/?tab=instagram-composer&instagramError=${encodeURIComponent(errorMsg)}`, req.url)
    );
  }
}
