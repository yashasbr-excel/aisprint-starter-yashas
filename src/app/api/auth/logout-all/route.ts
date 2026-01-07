import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { revokeAllUserSessions } from '@/lib/auth/session';
import { getDatabase } from '@/lib/d1-client';

export async function POST(request: NextRequest) {
  try {
    // Get token from cookie
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify token and get user ID
    const { userId } = await verifyToken(token);

    // Revoke all sessions for this user
    const db = getDatabase();
    await revokeAllUserSessions(db, userId);

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Logged out from all devices successfully',
    });

    // Clear the auth cookie
    response.cookies.delete('auth-token');

    return response;
  } catch (error) {
    console.error('Logout all error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

