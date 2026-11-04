import { auth } from '@/auth';
import { NextResponse } from 'next/server';

// App pages that need a session; anonymous visitors are sent to login.
const PROTECTED_PREFIXES = ['/today', '/dashboard', '/daily', '/concepts', '/stats', '/settings'];

// API routes that work without a session.
const PUBLIC_API_PREFIXES = ['/api/auth', '/api/github'];

const startsWithAny = (path: string, prefixes: string[]) => prefixes.some((p) => path.startsWith(p));

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const isLoggedIn = !!req.auth?.user;

  const isLanding = path === '/';
  const isAuthPage = path.startsWith('/auth');
  const isPublicApi = startsWithAny(path, PUBLIC_API_PREFIXES);
  // With an explicit auth error (e.g. SessionRequired) stay on the auth page instead of bouncing.
  const hasAuthError = isAuthPage && nextUrl.searchParams.has('error');

  if ((isLanding || isAuthPage) && isLoggedIn && !hasAuthError) {
    return NextResponse.redirect(new URL('/today', nextUrl));
  }

  if (isLanding || isAuthPage || isPublicApi || isLoggedIn) {
    return NextResponse.next();
  }

  if (path.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (startsWithAny(path, PROTECTED_PREFIXES)) {
    const callbackUrl = encodeURIComponent(path + nextUrl.search);
    return NextResponse.redirect(new URL(`/auth/login?callbackUrl=${callbackUrl}&error=SessionRequired`, nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!api/auth|api/github|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|opengraph-image|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico|.*\\.webp).*)',
  ],
};
