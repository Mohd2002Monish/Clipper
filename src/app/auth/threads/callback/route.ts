import { NextRequest, NextResponse } from 'next/server';
import { threadsService } from '@/lib/services/threadsService';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error') || searchParams.get('error_description');

    if (error) {
      logger.system('warn', 'THREADS_OAUTH_DENIED', `User denied Meta Threads OAuth: ${error}`);
      return NextResponse.redirect(
        new URL(`/?tab=threads-composer&threadsError=${encodeURIComponent(error)}`, req.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/?tab=threads-composer&threadsError=missing_authorization_code', req.url)
      );
    }

    const account = await threadsService.handleOAuthCallback(code);
    logger.system('info', 'THREADS_OAUTH_SUCCESS', `Connected Meta Threads Account @${account.username}`);

    return NextResponse.redirect(
      new URL(
        `/?tab=threads-composer&threadsConnected=true&username=${encodeURIComponent(account.username)}`,
        req.url
      )
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.system('error', 'THREADS_OAUTH_EXCEPTION', errorMsg);
    return NextResponse.redirect(
      new URL(`/?tab=threads-composer&threadsError=${encodeURIComponent(errorMsg)}`, req.url)
    );
  }
}
