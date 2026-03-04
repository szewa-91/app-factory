import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  isSessionSecretConfigured,
  SESSION_COOKIE_NAME,
  verifySignedSessionToken,
} from '@/lib/session';

export async function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const hasValidSession = await verifySignedSessionToken(sessionToken);
  const { pathname } = request.nextUrl;

  // Paths that are always public
  const publicPaths = ['/login', '/favicon.ico'];

  // Public API routes
  const publicApiPaths = ['/api/login', '/api/logout'];

  // 1. If user is authenticated and tries to access /login, redirect to /
  if (hasValidSession && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 2. Allow public paths
  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // 3. Allow public API routes
  if (publicApiPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 4. Skip static assets
  if (pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next();
  }

  // 5. Fail closed for protected routes when auth secret is missing.
  if (!isSessionSecretConfigured()) {
    if (pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({ success: false, message: 'Authentication is not configured' }),
        { status: 503, headers: { 'content-type': 'application/json' } }
      );
    }

    return new NextResponse('Authentication is not configured', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  // 6. Check signed session token
  if (!hasValidSession) {
    // Return 401 for API requests instead of redirecting
    if (pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 401, headers: { 'content-type': 'application/json' } }
      );
    }

    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
