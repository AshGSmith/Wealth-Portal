import { NextRequest, NextResponse } from 'next/server';
import { hasValidSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/proxy';

const PUBLIC_PATHS = ['/login', '/forgot-password'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/reset-password/');
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.')) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const hasSession = token ? hasValidSessionToken(token) : false;
  const publicPath = isPublicPath(pathname);

  if (!hasSession && !publicPath) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && publicPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.jpg).*)'],
};
