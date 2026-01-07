import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { createToken } from '@/lib/auth/jwt';
import { createSession } from '@/lib/auth/session';
import { getDatabase, executeQueryFirst, executeMutation } from '@/lib/d1-client';

interface SignupRequest {
  email: string;
  password: string;
  fullName: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SignupRequest;
    const { email, password, fullName } = body;

    // Validate input
    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { 
          error: 'Password does not meet requirements', 
          details: passwordValidation.errors 
        },
        { status: 400 }
      );
    }

    // Get database
    const db = getDatabase();

    // Check if user already exists
    const existingUser = await executeQueryFirst<{ id: string }>(
      db,
      'SELECT id FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userId = crypto.randomUUID();
    await executeMutation(
      db,
      `INSERT INTO users (id, email, password_hash, full_name)
       VALUES (?, ?, ?, ?)`,
      [userId, email.toLowerCase(), passwordHash, fullName]
    );

    // Generate temporary token for session creation
    const tempToken = crypto.randomUUID();

    // Create session
    const sessionId = await createSession(db, userId, tempToken, {
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    // Generate JWT token with session ID
    const token = await createToken({
      sessionId,
      userId,
      email: email.toLowerCase(),
    });

    // Create response
    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: userId,
          email: email.toLowerCase(),
          fullName,
        },
      },
      { status: 201 }
    );

    // Set HTTP-only cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

