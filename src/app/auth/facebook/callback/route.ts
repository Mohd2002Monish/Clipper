import { NextRequest, NextResponse } from 'next/server';
import { facebookService } from '@/lib/services/facebookService';
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
  const storedStateCookie = req.cookies.get('fb_oauth_state')?.value;

  const createRedirect = (url: URL) => {
    const res = NextResponse.redirect(url);
    res.cookies.delete('fb_oauth_state');
    return res;
  };

  try {
    if (error) {
      logger.system('warn', 'FACEBOOK_OAUTH_DENIED', `User denied Facebook OAuth: ${error}`);
      return createRedirect(
        new URL(`/?tab=facebook-composer&facebookError=${encodeURIComponent(error)}`, req.url)
      );
    }

    if (storedStateCookie && stateFromQuery && storedStateCookie !== stateFromQuery) {
      logger.system('error', 'FACEBOOK_OAUTH_CSRF_FAILED', 'OAuth state verification failed');
      return createRedirect(
        new URL('/?tab=facebook-composer&facebookError=csrf_state_mismatch', req.url)
      );
    }

    if (!code) {
      return createRedirect(
        new URL('/?tab=facebook-composer&facebookError=missing_authorization_code', req.url)
      );
    }

    const sanitizedCode = code.replace(/#_.*$/, '').replace(/#.*$/, '').trim();
    const accounts = await facebookService.handleOAuthCallback(sanitizedCode);

    const firstPageName = accounts[0]?.pageName || 'Page';
    logger.system(
      'info',
      'FACEBOOK_OAUTH_SUCCESS',
      `Successfully connected ${accounts.length} Facebook Page(s) via OAuth: ${firstPageName}`
    );

    return createRedirect(
      new URL(
        `/?tab=facebook-composer&facebookConnected=true&pageName=${encodeURIComponent(firstPageName)}`,
        req.url
      )
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.system('error', 'FACEBOOK_OAUTH_EXCEPTION', msg);
    return createRedirect(
      new URL(`/?tab=facebook-composer&facebookError=${encodeURIComponent(msg)}`, req.url)
    );
  }
}

