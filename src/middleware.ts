import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // 2. Optional Auth Token Check if APP_AUTH_TOKEN is configured in environment
  const expectedAuthToken = process.env.APP_AUTH_TOKEN;
  if (expectedAuthToken && path.startsWith('/api/') && !path.startsWith('/api/health')) {
    const authHeader = req.headers.get('authorization') || req.headers.get('x-api-token');
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (token !== expectedAuthToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Valid APP_AUTH_TOKEN required.' },
        { status: 401 }
      );
    }
  }

  // 3. Security headers
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-DNS-Prefetch-Control', 'on');

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
