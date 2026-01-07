import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { validateSession } from '@/lib/auth/session';
import { getDatabase, executeQueryFirst } from '@/lib/d1-client';

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  is_active: number;
}

export async function GET(request: NextRequest) {
  try {
    // Get token from cookie
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify token
    const { sessionId, userId } = await verifyToken(token);

    // Validate session is still active
    const db = getDatabase();
    const isValidSession = await validateSession(db, sessionId);

    if (!isValidSession) {
      // Session was revoked or expired
      const response = NextResponse.json(
        { error: 'Session invalid or expired' },
        { status: 401 }
      );
      response.cookies.delete('auth-token');
      return response;
    }

    // Get user from database
    const user = await executeQueryFirst<UserRow>(
      db,
      'SELECT id, email, full_name, is_active FROM users WHERE id = ?',
      [userId]
    );

    if (!user || user.is_active === 0) {
      return NextResponse.json(
        { error: 'User not found or inactive' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
      },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return NextResponse.json(
      { error: 'Invalid or expired token' },
      { status: 401 }
    );
  }
}

