import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';

/**
 * Login gate. Unauthenticated visitors to a protected route are bounced to
 * /login; already-authenticated visitors to /login are sent on to /products.
 * This is the "gate" behavior Argus writes and heals tests against.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthed = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === '/login') {
    if (isAuthed) {
      return NextResponse.redirect(new URL('/products', request.url));
    }
    return NextResponse.next();
  }

  if (!isAuthed) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Guard everything except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
