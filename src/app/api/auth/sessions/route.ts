import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { getUserSessions, revokeSession } from '@/lib/auth/session';
import { getDatabase } from '@/lib/d1-client';

/**
 * Simple user agent parser
 * @param userAgent - User agent string
 * @returns Device type description
 */
function parseUserAgent(userAgent?: string): string {
  if (!userAgent) return 'Unknown Device';

  if (userAgent.includes('Mobile')) return 'Mobile Device';
  if (userAgent.includes('Tablet')) return 'Tablet';
  if (userAgent.includes('Windows')) return 'Windows PC';
  if (userAgent.includes('Mac')) return 'Mac';
  if (userAgent.includes('Linux')) return 'Linux PC';

  return 'Unknown Device';
}

// GET - List all active sessions
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { userId, sessionId: currentSessionId } = await verifyToken(token);
    const db = getDatabase();

    const sessions = await getUserSessions(db, userId);

    // Format sessions for frontend
    const formattedSessions = sessions.map((session) => ({
      id: session.id,
      isCurrent: session.id === currentSessionId,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      device: parseUserAgent(session.userAgent),
    }));

    return NextResponse.json({
      success: true,
      sessions: formattedSessions,
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Revoke a specific session
export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { userId } = await verifyToken(token);
    const body = await request.json() as { sessionId: string };
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // Verify the session belongs to the user (security check)
    const sessions = await getUserSessions(db, userId);
    const sessionExists = sessions.some((s) => s.id === sessionId);

    if (!sessionExists) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Revoke the session
    await revokeSession(db, sessionId);

    return NextResponse.json({
      success: true,
      message: 'Session revoked successfully',
    });
  } catch (error) {
    console.error('Revoke session error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

