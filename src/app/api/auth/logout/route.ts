import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { revokeSession } from '@/lib/auth/session';
import { getDatabase } from '@/lib/d1-client';

export async function POST(request: NextRequest) {
  try {
    // Get token from cookie
    const token = request.cookies.get('auth-token')?.value;

    if (token) {
      try {
        // Verify token and get session ID
        const { sessionId } = await verifyToken(token);

        // Revoke session in database
        const db = getDatabase();
        await revokeSession(db, sessionId);
      } catch (error) {
        // Token invalid or expired - ignore and continue with logout
        console.error('Error revoking session:', error);
      }
    }

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    // Clear the auth cookie
    response.cookies.delete('auth-token');

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

