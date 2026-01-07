import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';

// Routes that require authentication
const protectedPaths = ['/dashboard', '/mcqs'];

// Routes that should redirect to dashboard if already authenticated
const authPaths = ['/login', '/signup'];

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;
  const { pathname } = request.nextUrl;

  // Check if the path is protected
  const isProtectedPath = protectedPaths.some((path) =>
    pathname.startsWith(path)
  );

  // Check if the path is an auth page
  const isAuthPath = authPaths.some((path) => pathname.startsWith(path));

  if (isProtectedPath) {
    // Protected route - require authentication
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      // Verify JWT token (lightweight check for Edge Runtime)
      // Full session validation will happen in API routes
      await verifyToken(token);
      return NextResponse.next();
    } catch {
      // Invalid token - redirect to login
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('auth-token');
      return response;
    }
  }

  if (isAuthPath && token) {
    // User is already authenticated, redirect to dashboard
    try {
      // Just verify the JWT is valid
      await verifyToken(token);
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } catch {
      // Invalid token - clear it and continue to auth page
      const response = NextResponse.next();
      response.cookies.delete('auth-token');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*$).*)',
  ],
};

