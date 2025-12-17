# Basic Authentication Implementation Guide for QuizMaker

## Overview

This document outlines the authentication strategy and implementation plan for the QuizMaker application. Since users need to be authenticated to create quizzes, we need a secure, scalable authentication system.

---

## Table of Contents

1. [Authentication Strategy Options](#authentication-strategy-options)
2. [Recommended Approach](#recommended-approach)
3. [Key Considerations](#key-considerations)
4. [Database Schema Design](#database-schema-design)
5. [Implementation Plan](#implementation-plan)
6. [Security Best Practices](#security-best-practices)
7. [User Flow Diagrams](#user-flow-diagrams)
8. [Session Management](#session-management)
9. [Code Examples](#code-examples)

---

## Authentication Strategy Options

### Option 1: Email/Password Authentication (Recommended for MVP)
**Pros:**
- ✅ Full control over user data
- ✅ No third-party dependencies
- ✅ Works in all environments
- ✅ Simple to implement
- ✅ Good for teacher-focused app

**Cons:**
- ❌ Need to handle password security
- ❌ Need to implement password reset
- ❌ Users need to remember another password

**Best For:** MVP, internal tools, education-focused apps

---

### Option 2: OAuth (Google, Microsoft, etc.)
**Pros:**
- ✅ No password management
- ✅ Higher security (delegated to providers)
- ✅ Faster user signup
- ✅ Familiar to users

**Cons:**
- ❌ Dependency on third parties
- ❌ More complex setup
- ❌ May require user consent screens

**Best For:** Public-facing apps, SaaS products

---

### Option 3: Magic Link (Passwordless)
**Pros:**
- ✅ No passwords to manage
- ✅ Better UX (click email link)
- ✅ More secure (time-limited tokens)

**Cons:**
- ❌ Requires email service
- ❌ Can be slower (wait for email)
- ❌ Email deliverability issues

**Best For:** Modern apps prioritizing UX

---

### Option 4: NextAuth.js (Auth.js)
**Pros:**
- ✅ Supports multiple strategies
- ✅ Well-maintained library
- ✅ Built for Next.js
- ✅ Handles sessions automatically

**Cons:**
- ❌ Additional dependency
- ❌ Some setup complexity
- ❌ Learning curve

**Best For:** Apps needing multiple auth providers

---

## Recommended Approach

### **For QuizMaker MVP: Email/Password with JWT Sessions**

**Why this approach?**
1. **Teacher-focused:** Teachers are comfortable with email/password
2. **Simple to implement:** Minimal dependencies
3. **Full control:** We own all user data
4. **Cloudflare compatible:** Works perfectly with D1 and Workers
5. **Scalable:** Can add OAuth later if needed

---

## Key Considerations

### 1. **User Identity & Profile**
What information do we need to store?
- ✅ Email address (unique identifier)
- ✅ Full name
- ✅ Password (hashed)
- ✅ Account creation date
- ✅ Last login date
- ✅ Email verification status
- ⚠️ Optional: School/Institution
- ⚠️ Optional: Teaching subject
- ⚠️ Optional: Grade level

### 2. **Password Security**
- ✅ Hash passwords using bcrypt or Argon2
- ✅ Minimum password requirements (8+ characters, complexity)
- ✅ Salt passwords before hashing
- ✅ Never store plain text passwords
- ✅ Implement password reset functionality

### 3. **Session Management**
- ✅ Use JWT (JSON Web Tokens) for stateless sessions
- ✅ Store tokens in HTTP-only cookies
- ✅ Set appropriate expiration times
- ✅ Implement token refresh mechanism
- ✅ Secure token storage

### 4. **Email Verification**
- ✅ Send verification email on signup
- ✅ Store verification token with expiration
- ✅ Verify email before allowing full access
- ⚠️ Optional for MVP, recommended for production

### 5. **Authorization & Permissions**
- ✅ Users can only edit their own quizzes
- ✅ Users can only delete their own content
- ✅ Row-level security in database queries
- ⚠️ Future: Role-based access (teacher, admin, student)

### 6. **Rate Limiting & Security**
- ✅ Limit login attempts (prevent brute force)
- ✅ CAPTCHA for repeated failures (optional)
- ✅ Log suspicious activity
- ✅ Block IPs after multiple failures

### 7. **Error Handling**
- ✅ Generic error messages (don't reveal if email exists)
- ✅ Handle edge cases (deleted accounts, locked accounts)
- ✅ Graceful degradation

---

## Database Schema Design

### Users Table

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email_verified INTEGER DEFAULT 0, -- 0 = false, 1 = true
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME,
  is_active INTEGER DEFAULT 1, -- 0 = inactive, 1 = active
  
  -- Optional fields for future
  school_name TEXT,
  teaching_subject TEXT,
  grade_level TEXT
);

-- Index for faster email lookups
CREATE INDEX idx_users_email ON users(email);

-- Index for active users
CREATE INDEX idx_users_active ON users(is_active);
```

### Sessions Table (Optional - for tracking active sessions)

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for faster token lookups
CREATE INDEX idx_sessions_token ON sessions(token_hash);

-- Index for cleanup of expired sessions
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Index for user's sessions
CREATE INDEX idx_sessions_user ON sessions(user_id);
```

### Email Verification Tokens Table

```sql
CREATE TABLE verification_tokens (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  token_type TEXT NOT NULL, -- 'email_verification', 'password_reset'
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  used_at DATETIME,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for token lookups
CREATE INDEX idx_verification_tokens_token ON verification_tokens(token);

-- Index for cleanup
CREATE INDEX idx_verification_tokens_expires ON verification_tokens(expires_at);
```

### Password Reset Attempts (Rate Limiting)

```sql
CREATE TABLE login_attempts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  success INTEGER DEFAULT 0, -- 0 = failed, 1 = success
  attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for rate limiting queries
CREATE INDEX idx_login_attempts_email_time ON login_attempts(email, attempted_at);
CREATE INDEX idx_login_attempts_ip_time ON login_attempts(ip_address, attempted_at);
```

---

## Implementation Plan

### Phase 1: Core Authentication (Week 1)

#### Step 1: Database Setup
- [ ] Create users table migration
- [ ] Create sessions table migration (if using DB sessions)
- [ ] Create verification_tokens table migration
- [ ] Create login_attempts table migration
- [ ] Apply migrations locally

#### Step 2: Password Hashing Library
- [ ] Install bcryptjs: `npm install bcryptjs @types/bcryptjs`
- [ ] Create password utility functions
  - `hashPassword(password: string): Promise<string>`
  - `verifyPassword(password: string, hash: string): Promise<boolean>`

#### Step 3: JWT Token Management
- [ ] Install jose (JWT for Edge): `npm install jose`
- [ ] Create JWT utility functions
  - `createToken(userId: string, email: string): Promise<string>`
  - `verifyToken(token: string): Promise<{ userId: string, email: string }>`
  - `refreshToken(token: string): Promise<string>`

#### Step 4: User Registration
- [ ] Create signup API route: `/api/auth/signup`
- [ ] Validate email format
- [ ] Check if email already exists
- [ ] Hash password
- [ ] Create user in database
- [ ] Generate JWT token
- [ ] Set HTTP-only cookie
- [ ] Return success response

#### Step 5: User Login
- [ ] Create login API route: `/api/auth/login`
- [ ] Validate credentials
- [ ] Check rate limiting
- [ ] Verify password hash
- [ ] Generate JWT token
- [ ] Update last_login_at
- [ ] Set HTTP-only cookie
- [ ] Return user data

#### Step 6: User Logout
- [ ] Create logout API route: `/api/auth/logout`
- [ ] Clear HTTP-only cookie
- [ ] Invalidate session (if using DB sessions)
- [ ] Return success response

#### Step 7: Auth Middleware
- [ ] Create middleware to check authentication
- [ ] Read JWT from cookie
- [ ] Verify token validity
- [ ] Attach user to request context
- [ ] Redirect to login if not authenticated

---

### Phase 2: User Interface (Week 2)

#### Step 8: Login Page
- [ ] Create `/login` route
- [ ] Design login form (email, password)
- [ ] Add client-side validation
- [ ] Handle form submission
- [ ] Display error messages
- [ ] Redirect to dashboard on success

#### Step 9: Signup Page
- [ ] Create `/signup` route
- [ ] Design signup form (name, email, password, confirm password)
- [ ] Add client-side validation
- [ ] Password strength indicator
- [ ] Handle form submission
- [ ] Display error messages
- [ ] Redirect to dashboard or email verification

#### Step 10: Protected Routes
- [ ] Create auth context/provider
- [ ] Wrap app with auth provider
- [ ] Create `useAuth()` hook
- [ ] Protect quiz creation routes
- [ ] Add loading states
- [ ] Handle unauthorized access

#### Step 11: User Profile
- [ ] Create `/profile` route
- [ ] Display user information
- [ ] Allow profile editing
- [ ] Change password functionality

---

### Phase 3: Advanced Features (Week 3+)

#### Step 12: Email Verification
- [ ] Generate verification token on signup
- [ ] Send verification email
- [ ] Create verification route
- [ ] Verify token and mark email as verified
- [ ] Handle expired tokens

#### Step 13: Password Reset
- [ ] Create "Forgot Password" page
- [ ] Generate reset token
- [ ] Send reset email
- [ ] Create reset password page
- [ ] Validate token
- [ ] Update password
- [ ] Invalidate token after use

#### Step 14: Rate Limiting
- [ ] Implement login attempt tracking
- [ ] Block accounts after N failed attempts
- [ ] Add time-based cooldowns
- [ ] Log suspicious activity

#### Step 15: Security Enhancements
- [ ] Add CSRF protection
- [ ] Implement session timeout
- [ ] Add "Remember Me" functionality
- [ ] Multi-device session management
- [ ] Security audit logging

---

## Security Best Practices

### 1. **Password Storage**
```typescript
// NEVER do this
const password = "user-password";
await db.insert({ password }); // ❌ WRONG

// ALWAYS do this
import bcrypt from 'bcryptjs';
const passwordHash = await bcrypt.hash(password, 10);
await db.insert({ password_hash: passwordHash }); // ✅ CORRECT
```

### 2. **JWT Token Storage**
```typescript
// ❌ WRONG - LocalStorage vulnerable to XSS
localStorage.setItem('token', jwt);

// ✅ CORRECT - HTTP-only cookie
cookies().set('auth-token', jwt, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7 // 7 days
});
```

### 3. **Password Requirements**
```typescript
const passwordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false // Optional for teachers
};
```

### 4. **Rate Limiting**
```typescript
// Limit login attempts: 5 attempts per 15 minutes
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
```

### 5. **Token Expiration**
```typescript
const TOKEN_EXPIRY = {
  access: '15m',      // Access token: 15 minutes
  refresh: '7d',      // Refresh token: 7 days
  verification: '24h', // Email verification: 24 hours
  reset: '1h'         // Password reset: 1 hour
};
```

---

## User Flow Diagrams

### Registration Flow
```
┌──────────────┐
│  User visits │
│ /signup page │
└──────┬───────┘
       │
       ▼
┌─────────────────────┐
│ Fills form:         │
│ - Name              │
│ - Email             │
│ - Password          │
│ - Confirm Password  │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Client validation   │
│ - Email format      │
│ - Password strength │
│ - Passwords match   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ POST /api/auth/     │
│      signup         │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Server validates:   │
│ - Email unique?     │
│ - Password strong?  │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Hash password       │
│ Create user in DB   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Generate JWT token  │
│ Set HTTP-only cookie│
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ (Optional)          │
│ Send verification   │
│ email               │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Redirect to         │
│ /dashboard          │
└─────────────────────┘
```

### Login Flow
```
┌──────────────┐
│  User visits │
│ /login page  │
└──────┬───────┘
       │
       ▼
┌─────────────────────┐
│ Fills form:         │
│ - Email             │
│ - Password          │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Client validation   │
│ - Email format      │
│ - Password not empty│
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ POST /api/auth/     │
│      login          │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Server checks:      │
│ - Rate limit OK?    │
│ - User exists?      │
│ - Account active?   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Verify password     │
│ using bcrypt        │
└──────┬──────────────┘
       │
       ├─── Invalid ──┐
       │              │
       ▼              ▼
   Success      ┌──────────────┐
       │        │ Log attempt  │
       │        │ Return error │
       │        └──────────────┘
       ▼
┌─────────────────────┐
│ Generate JWT token  │
│ Set HTTP-only cookie│
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Update last_login_at│
│ Log success attempt │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Return user data    │
│ Redirect to         │
│ /dashboard          │
└─────────────────────┘
```

### Protected Route Access
```
┌──────────────┐
│ User requests│
│ /quizzes/new │
└──────┬───────┘
       │
       ▼
┌─────────────────────┐
│ Middleware checks   │
│ auth-token cookie   │
└──────┬──────────────┘
       │
       ├─── No token ──┐
       │               │
       ▼               ▼
   Has token    ┌──────────────┐
       │        │ Redirect to  │
       │        │ /login       │
       │        └──────────────┘
       ▼
┌─────────────────────┐
│ Verify JWT token    │
│ signature & expiry  │
└──────┬──────────────┘
       │
       ├─── Invalid ───┐
       │               │
       ▼               ▼
    Valid       ┌──────────────┐
       │        │ Clear cookie │
       │        │ Redirect to  │
       │        │ /login       │
       │        └──────────────┘
       ▼
┌─────────────────────┐
│ Extract user from   │
│ token payload       │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Load user from DB   │
│ (optional, for      │
│  fresh data)        │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Attach user to      │
│ request context     │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Allow access to     │
│ protected page      │
└─────────────────────┘
```

---

## Session Management

### Option A: Stateless JWT (Recommended for Cloudflare Workers)

**How it works:**
1. User logs in → Server generates JWT
2. JWT contains: userId, email, expiration
3. JWT stored in HTTP-only cookie
4. Every request includes cookie
5. Server verifies JWT signature
6. No database lookup needed

**Pros:**
- Fast (no DB queries)
- Scalable (stateless)
- Works well with Cloudflare Workers

**Cons:**
- Can't invalidate tokens (except expiry)
- Token size limited
- Refresh tokens needed

**Implementation:**
```typescript
// Create token
import { SignJWT } from 'jose';

async function createToken(userId: string, email: string) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  
  return await new SignJWT({ userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

// Verify token
import { jwtVerify } from 'jose';

async function verifyToken(token: string) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const { payload } = await jwtVerify(token, secret);
  return payload as { userId: string; email: string };
}
```

---

### Option B: Database Sessions

**How it works:**
1. User logs in → Server creates session record
2. Session ID stored in cookie
3. Every request → lookup session in DB
4. Can invalidate anytime

**Pros:**
- Can logout all devices
- Can track active sessions
- Better security (can revoke)

**Cons:**
- DB query on every request
- More complex
- Slower than JWT

---

## Code Examples

### 1. Password Utility (`lib/auth/password.ts`)

```typescript
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

---

### 2. JWT Utility (`lib/auth/jwt.ts`)

```typescript
import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

export interface JWTPayload {
  userId: string;
  email: string;
}

export async function createToken(payload: JWTPayload): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}
```

---

### 3. Signup API Route (`app/api/auth/signup/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { createToken } from '@/lib/auth/jwt';
import { getDatabase } from '@/lib/d1-client';

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName } = await request.json();

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
        { error: 'Weak password', details: passwordValidation.errors },
        { status: 400 }
      );
    }

    // Get database
    const db = getDatabase(request);

    // Check if user already exists
    const existingUser = await db
      .prepare('SELECT id FROM users WHERE email = ?1')
      .bind(email.toLowerCase())
      .first();

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
    await db
      .prepare(
        `INSERT INTO users (id, email, password_hash, full_name)
         VALUES (?1, ?2, ?3, ?4)`
      )
      .bind(userId, email.toLowerCase(), passwordHash, fullName)
      .run();

    // Generate JWT token
    const token = await createToken({
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
```

---

### 4. Login API Route (`app/api/auth/login/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/auth/password';
import { createToken } from '@/lib/auth/jwt';
import { getDatabase } from '@/lib/d1-client';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Get database
    const db = getDatabase(request);

    // Find user
    const user = await db
      .prepare(
        `SELECT id, email, password_hash, full_name, is_active
         FROM users
         WHERE email = ?1`
      )
      .bind(email.toLowerCase())
      .first<{
        id: string;
        email: string;
        password_hash: string;
        full_name: string;
        is_active: number;
      }>();

    // Generic error message (don't reveal if email exists)
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if account is active
    if (user.is_active === 0) {
      return NextResponse.json(
        { error: 'Account is inactive' },
        { status: 403 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(
      password,
      user.password_hash
    );

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Update last login
    await db
      .prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?1')
      .bind(user.id)
      .run();

    // Generate JWT token
    const token = await createToken({
      userId: user.id,
      email: user.email,
    });

    // Create response
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
      },
    });

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
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

### 5. Auth Middleware (`middleware.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';

// Routes that require authentication
const protectedPaths = ['/dashboard', '/quizzes', '/profile'];

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
      // Verify token
      await verifyToken(token);
      return NextResponse.next();
    } catch (error) {
      // Invalid token - redirect to login
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('auth-token');
      return response;
    }
  }

  if (isAuthPath && token) {
    // User is already authenticated, redirect to dashboard
    try {
      await verifyToken(token);
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } catch (error) {
      // Invalid token - clear it and continue
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
```

---

### 6. Auth Context (`lib/auth/auth-context.tsx`)

```typescript
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

interface User {
  id: string;
  email: string;
  fullName: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated on mount
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    setUser(data.user);
  }

  async function signup(email: string, password: string, fullName: string) {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Signup failed');
    }

    const data = await response.json();
    setUser(data.user);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

---

## Next Steps

1. **Review this document** and decide on authentication approach
2. **Create database migrations** for users and related tables
3. **Install dependencies** (bcryptjs, jose)
4. **Implement core auth APIs** (signup, login, logout)
5. **Create auth UI components** (login form, signup form)
6. **Add middleware** for route protection
7. **Test authentication flow** thoroughly
8. **Add advanced features** (email verification, password reset)

---

## Environment Variables Required

Add to `.dev.vars` (local) and Cloudflare secrets (production):

```env
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
```

Generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Recommended Libraries

```bash
# Password hashing
npm install bcryptjs @types/bcryptjs

# JWT for Cloudflare Workers
npm install jose

# Email validation (optional)
npm install validator @types/validator

# Form validation
npm install zod react-hook-form @hookform/resolvers
```

---

## Questions to Answer Before Implementation

1. **Do we need email verification for MVP?** (Recommended: No for MVP, Yes for production)
2. **Should we implement "Remember Me"?** (Recommended: Yes, extend token expiry)
3. **Do we need password reset immediately?** (Recommended: Yes, important for user experience)
4. **Should we track multiple sessions?** (Recommended: No for MVP)
5. **Do we need OAuth providers?** (Recommended: Not for MVP)
6. **What should be the token expiry time?** (Recommended: 7 days)
7. **Should we log all login attempts?** (Recommended: Yes, for security)

---

**Status:** Ready for implementation  
**Estimated Time:** 1-2 weeks for complete authentication system  
**Last Updated:** December 16, 2025

