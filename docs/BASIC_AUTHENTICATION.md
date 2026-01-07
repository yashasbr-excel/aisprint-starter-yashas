# Email/Password Authentication Guide for QuizMaker MVP

## Overview

This document outlines the **Email/Password authentication implementation** for the QuizMaker MVP. This is the simplest, most reliable authentication strategy for our teacher-focused application, with no third-party dependencies.

---

## Table of Contents

1. [Why Email/Password for MVP](#why-emailpassword-for-mvp)
2. [MVP Scope](#mvp-scope)
3. [Database Schema Design](#database-schema-design)
4. [Implementation Plan](#implementation-plan)
5. [Security Best Practices](#security-best-practices)
6. [User Flow Diagrams](#user-flow-diagrams)
7. [Session Management](#session-management)
8. [Code Examples](#code-examples)
9. [Testing Checklist](#testing-checklist)

---

## Why Email/Password for MVP

**Selected Strategy:** Email/Password with JWT + Session Tracking

### Benefits for MVP
- ✅ **Simple to implement** - Minimal dependencies, straightforward flow
- ✅ **Full control** - We own all user data
- ✅ **No external dependencies** - Works offline, no third-party services
- ✅ **Cloudflare compatible** - Perfect for D1 and Workers
- ✅ **Teacher-friendly** - Familiar login experience
- ✅ **Session tracking** - Can logout all devices, track active sessions
- ✅ **Scalable** - Can add OAuth/SSO later if needed

### What We're Building
```
User Registration → Email/Password → JWT Token + Session ID → Protected Dashboard
                                    ↓
                              Session Tracking (DB)
```

---

## MVP Scope

### ✅ Build for MVP (Phase 1)

**Core Authentication:**
- [ ] User signup with email/password
- [ ] User login with email/password
- [ ] User logout (single device)
- [ ] Logout all devices
- [ ] Password hashing (bcrypt)
- [ ] JWT token generation and verification
- [ ] Session tracking in database
- [ ] HTTP-only cookie storage
- [ ] Protected routes (middleware)
- [ ] Basic auth context for React

**Database:**
- [ ] `users` table
- [ ] `sessions` table (track active sessions)

**UI Pages:**
- [ ] `/signup` - Registration form
- [ ] `/login` - Login form
- [ ] Basic error handling
- [ ] Redirect to dashboard after login

### 🔄 Add Later (Phase 2+)

**Advanced Features:**
- Email verification
- Password reset functionality
- "Remember me" functionality
- Rate limiting (login attempts)
- Account settings page
- Social OAuth (Google, Microsoft)
- Advanced session analytics

---

## Database Schema Design

### MVP Schema: Users + Sessions Tables

For MVP, we need TWO tables:

#### 1. Users Table

```sql
CREATE TABLE users (
  -- Primary Key
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  
  -- Authentication
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  
  -- User Info
  full_name TEXT NOT NULL,
  
  -- Status
  is_active INTEGER DEFAULT 1, -- 0 = inactive, 1 = active
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME
);

-- Index for faster email lookups (important for login)
CREATE INDEX idx_users_email ON users(email);

-- Index for active users
CREATE INDEX idx_users_active ON users(is_active);
```

#### 2. Sessions Table (Session Tracking)

```sql
CREATE TABLE sessions (
  -- Primary Key
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  
  -- User reference
  user_id TEXT NOT NULL,
  
  -- Session token (hashed for security)
  token_hash TEXT NOT NULL UNIQUE,
  
  -- Session metadata
  ip_address TEXT,
  user_agent TEXT,
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Status
  is_active INTEGER DEFAULT 1, -- 0 = revoked, 1 = active
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for faster token lookups
CREATE INDEX idx_sessions_token ON sessions(token_hash);

-- Index for cleanup of expired sessions
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Index for user's sessions
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- Index for active sessions only
CREATE INDEX idx_sessions_active ON sessions(user_id, is_active);
```

### What We're NOT Building for MVP

These tables are for later phases:

```sql
-- ❌ NOT FOR MVP - Add in Phase 2
CREATE TABLE verification_tokens (...);   -- Email verification
CREATE TABLE login_attempts (...);        -- Rate limiting
```

### Optional Fields for MVP

You can add these to the `users` table if needed, but they're optional:

```sql
-- Optional: Teacher-specific metadata
school_name TEXT,
teaching_subject TEXT,
grade_level TEXT
```

---

## Implementation Plan

### Phase 1: MVP Authentication (This Sprint)

**Implementation Steps** (in order of dependencies):

---

#### Step 1: Database Setup

**Tasks:**
- [ ] Create migration file for `users` and `sessions` tables
- [ ] Apply migration locally using Wrangler
- [ ] Verify table structure in D1

**Commands:**
```bash
# Create migration
npx wrangler d1 migrations create quizmaker-database create_auth_tables

# Apply migration locally
npx wrangler d1 migrations apply quizmaker-database --local
```

**Migration File Example:**
```sql
-- migrations/0001_create_auth_tables.sql

-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);

-- Sessions table
CREATE TABLE sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_active ON sessions(user_id, is_active);
```

---

#### Step 2: Install Dependencies

**Install required packages:**
```bash
# Password hashing
npm install bcryptjs @types/bcryptjs

# JWT for Cloudflare Workers (Edge-compatible)
npm install jose

# Already installed: zod (for validation)
```

**Dependencies breakdown:**
- `bcryptjs` - Hash passwords securely
- `jose` - JWT library that works in Cloudflare Workers
- `zod` - Input validation (already in project)

---

#### Step 3: Create Utility Functions

**Create these files:**

1. **Password utilities** - `src/lib/auth/password.ts`
   - `hashPassword(password: string): Promise<string>`
   - `verifyPassword(password: string, hash: string): Promise<boolean>`
   - `validatePasswordStrength(password: string): { valid: boolean; errors: string[] }`

2. **JWT utilities** - `src/lib/auth/jwt.ts`
   - `createToken(sessionId: string, userId: string, email: string): Promise<string>`
   - `verifyToken(token: string): Promise<{ sessionId: string; userId: string; email: string }>`

3. **Session utilities** - `src/lib/auth/session.ts`
   - `createSession(db, userId, token, metadata): Promise<string>`
   - `getSession(db, sessionId): Promise<Session | null>`
   - `validateSession(db, sessionId): Promise<boolean>`
   - `revokeSession(db, sessionId): Promise<void>`
   - `revokeAllUserSessions(db, userId): Promise<void>`
   - `cleanupExpiredSessions(db): Promise<void>`

4. **D1 client helper** - `src/lib/d1-client.ts` (if not exists)
   - Database access helper functions

---

#### Step 4: Build API Routes

**Dependencies:** Requires Steps 1-3 to be complete

**Create these API endpoints:**

1. **Signup** - `src/app/api/auth/signup/route.ts`
   - Validate email format
   - Check password strength
   - Check if email already exists
   - Hash password
   - Create user in database
   - Create session in database
   - Generate JWT token (with session ID)
   - Set HTTP-only cookie
   - Return user data

2. **Login** - `src/app/api/auth/login/route.ts`
   - Validate credentials
   - Find user by email
   - Verify password hash
   - Update `last_login_at`
   - Create session in database
   - Generate JWT token (with session ID)
   - Set HTTP-only cookie
   - Return user data

3. **Logout** - `src/app/api/auth/logout/route.ts`
   - Verify JWT from cookie
   - Revoke session in database
   - Clear HTTP-only cookie
   - Return success

4. **Logout All Devices** - `src/app/api/auth/logout-all/route.ts`
   - Verify JWT from cookie
   - Revoke all user's sessions in database
   - Clear HTTP-only cookie
   - Return success

5. **Get Current User** - `src/app/api/auth/me/route.ts`
   - Verify JWT from cookie
   - Validate session is still active
   - Return current user data
   - Used by frontend to check auth state

6. **Get Active Sessions** - `src/app/api/auth/sessions/route.ts` (optional)
   - List user's active sessions
   - Show device info, last active time
   - Allow revoking individual sessions

---

#### Step 5: Create Middleware

**Dependencies:** Requires JWT and Session utilities (Step 3)

**File:** `src/middleware.ts`

**Purpose:**
- Protect routes that require authentication
- Redirect unauthenticated users to `/login`
- Redirect authenticated users away from `/login` and `/signup`

**Protected routes for MVP:**
- `/dashboard` - Main dashboard after login
- `/mcqs/*` - All MCQ-related pages

**Public routes:**
- `/` - Landing page
- `/login` - Login page
- `/signup` - Registration page

---

#### Step 6: Build UI Pages

**Dependencies:** Requires API routes (Step 4)

**Create these pages:**

1. **Signup Page** - `src/app/signup/page.tsx`
   - Form fields: Full Name, Email, Password, Confirm Password
   - Client-side validation
   - Show password strength indicator
   - Submit to `/api/auth/signup`
   - Redirect to `/dashboard` on success
   - Show errors inline

2. **Login Page** - `src/app/login/page.tsx`
   - Form fields: Email, Password
   - Client-side validation
   - Submit to `/api/auth/login`
   - Redirect to `/dashboard` on success
   - Show errors inline
   - Link to signup page

3. **Dashboard Page** - `src/app/dashboard/page.tsx`
   - Protected route (requires authentication)
   - Show "Welcome, [User Name]"
   - Link to MCQs page
   - Logout button

---

#### Step 7: Create Auth Context

**Dependencies:** Requires API routes (Step 4)

**File:** `src/lib/auth/auth-context.tsx`

**Purpose:**
- Provide auth state to entire app
- `useAuth()` hook for accessing user data
- Functions: `login()`, `signup()`, `logout()`

**Usage in components:**
```typescript
const { user, loading, logout } = useAuth();

if (loading) return <LoadingSpinner />;
if (!user) return <LoginPrompt />;

return <div>Welcome, {user.fullName}!</div>;
```

---

### Step 8: Environment Variables

**Note:** Should be done at the beginning (Step 1 or 2)

**File:** `.dev.vars` (for local development)

```env
# Existing
NEXTJS_ENV=development

# Add this (generate a secure secret)
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
```

**Generate secure secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**For Production (Cloudflare):**
```bash
# Set secret in Cloudflare (don't commit this)
npx wrangler secret put JWT_SECRET
```

---

## Security Best Practices

### 1. Password Storage (CRITICAL)

```typescript
// ❌ NEVER DO THIS
const user = { email, password: "plaintext123" };
await db.insert(user); // WRONG! Security breach!

// ✅ ALWAYS DO THIS
import bcrypt from 'bcryptjs';
const passwordHash = await bcrypt.hash(password, 10);
await db.insert({ email, password_hash: passwordHash });
```

### 2. JWT Token Storage (CRITICAL)

```typescript
// ❌ NEVER DO THIS
localStorage.setItem('token', jwt); // Vulnerable to XSS attacks!

// ✅ ALWAYS DO THIS
response.cookies.set('auth-token', jwt, {
  httpOnly: true,        // JavaScript can't access it
  secure: true,          // HTTPS only in production
  sameSite: 'lax',       // CSRF protection
  maxAge: 60 * 60 * 24 * 7, // 7 days
  path: '/',
});
```

### 3. Password Requirements (MVP)

```typescript
const passwordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false, // Optional for teachers
};
```

**Example valid passwords:**
- ✅ `Password123`
- ✅ `TeacherRock2024`
- ✅ `MyQuiz2025`
- ❌ `password` (no uppercase/numbers)
- ❌ `Pass1` (too short)

### 4. Token Expiration (MVP)

```typescript
const TOKEN_EXPIRY = {
  access: '7d', // 7 days for MVP (adjust based on security needs)
};
```

For MVP, we use a single long-lived token. In Phase 2, we can add refresh tokens.

### 5. Error Messages (Security)

```typescript
// ❌ WRONG - Reveals if email exists
if (!user) return { error: 'Email not found' };

// ✅ CORRECT - Generic message
if (!user || !validPassword) {
  return { error: 'Invalid email or password' };
}
```

---

## User Flow Diagrams

### Registration Flow (MVP)

```
┌──────────────────┐
│  User visits     │
│  /signup         │
└────────┬─────────┘
         │
         ▼
┌─────────────────────────┐
│  Fill registration form:│
│  - Full Name            │
│  - Email                │
│  - Password             │
│  - Confirm Password     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Client validation:     │
│  ✓ Email format         │
│  ✓ Password strength    │
│  ✓ Passwords match      │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  POST /api/auth/signup  │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Server validates:      │
│  ✓ Email unique?        │
│  ✓ Password strong?     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Hash password (bcrypt) │
│  Create user in DB      │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Generate JWT token     │
│  Set HTTP-only cookie   │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Redirect to /dashboard │
│  User is now logged in  │
└─────────────────────────┘
```

### Login Flow (MVP)

```
┌──────────────────┐
│  User visits     │
│  /login          │
└────────┬─────────┘
         │
         ▼
┌─────────────────────────┐
│  Fill login form:       │
│  - Email                │
│  - Password             │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  POST /api/auth/login   │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Find user by email     │
│  in database            │
└────────┬────────────────┘
         │
         ├─── Not Found ──┐
         │                │
         ▼                ▼
     Found            ┌──────────────────┐
         │            │ Return error:    │
         │            │ "Invalid email   │
         │            │  or password"    │
         │            └──────────────────┘
         ▼
┌─────────────────────────┐
│  Verify password hash   │
│  using bcrypt.compare() │
└────────┬────────────────┘
         │
         ├─── Invalid ────┐
         │                │
         ▼                ▼
      Valid          ┌──────────────────┐
         │           │ Return error:    │
         │           │ "Invalid email   │
         │           │  or password"    │
         │           └──────────────────┘
         ▼
┌─────────────────────────┐
│  Update last_login_at   │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Generate JWT token     │
│  Set HTTP-only cookie   │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Redirect to /dashboard │
│  User is now logged in  │
└─────────────────────────┘
```

### Protected Route Access (MVP)

```
┌──────────────────┐
│  User navigates  │
│  to /dashboard   │
└────────┬─────────┘
         │
         ▼
┌─────────────────────────┐
│  Middleware checks      │
│  for auth-token cookie  │
└────────┬────────────────┘
         │
         ├─── No Cookie ──┐
         │                │
         ▼                ▼
    Has Cookie     ┌──────────────────┐
         │         │ Redirect to:     │
         │         │ /login?redirect= │
         │         │ /dashboard       │
         │         └──────────────────┘
         ▼
┌─────────────────────────┐
│  Verify JWT signature   │
│  and expiration         │
└────────┬────────────────┘
         │
         ├─── Invalid ────┐
         │                │
         ▼                ▼
      Valid          ┌──────────────────┐
         │           │ Clear cookie     │
         │           │ Redirect to      │
         │           │ /login           │
         │           └──────────────────┘
         ▼
┌─────────────────────────┐
│  Extract userId & email │
│  from token payload     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Allow access to        │
│  /dashboard page        │
│  Show user content      │
└─────────────────────────┘
```

---

## Session Management

### Hybrid JWT + Session Tracking (Selected for MVP)

**How it works:**
1. User logs in → Server creates session record in DB
2. Server generates JWT containing: `{ sessionId, userId, email, exp }`
3. JWT stored in HTTP-only cookie
4. Every request includes cookie automatically
5. Server verifies JWT signature AND checks if session is still active
6. Session can be revoked at any time (logout all devices)

**Pros:**
- ✅ Can revoke sessions immediately (logout all devices)
- ✅ Track active sessions per user
- ✅ Know device info, last active time
- ✅ Better security (can detect suspicious activity)
- ✅ Still fast (only 1 DB query to validate session)

**Cons:**
- ⚠️ Requires DB query on protected routes
- ⚠️ Slightly more complex than pure JWT

**Why this approach for MVP:**
- Teachers may use multiple devices (home, school, mobile)
- Need ability to "logout all devices" if device is lost/stolen
- Can see where they're logged in
- Better security without significant complexity

### Session Lifecycle

```
Login → Create Session (DB) → Generate JWT (with sessionId) → Cookie
                                                               ↓
Request → Verify JWT → Validate Session (DB) → Allow/Deny
                       (is_active = 1?)
                                                               ↓
Logout → Revoke Session (DB) → Clear Cookie → Session invalid

Logout All → Revoke All Sessions (DB) → User must re-login everywhere
```

---

## Code Examples

### 1. Password Utility (`src/lib/auth/password.ts`)

```typescript
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hash a plain text password
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against its hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * Validate password strength
 */
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

### 2. JWT Utility (`src/lib/auth/jwt.ts`)

```typescript
import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

export interface JWTPayload {
  sessionId: string;
  userId: string;
  email: string;
}

/**
 * Create a JWT token with session ID
 */
export async function createToken(payload: JWTPayload): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // 7 days
    .sign(JWT_SECRET);
}

/**
 * Verify and decode a JWT token
 */
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

### 3. Session Utility (`src/lib/auth/session.ts`)

```typescript
import { executeQuery, executeQueryFirst, executeMutation } from '@/lib/d1-client';
import crypto from 'crypto';

export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  expiresAt: string;
  lastActiveAt: string;
  isActive: number;
}

/**
 * Hash a session token for storage
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new session
 */
export async function createSession(
  db: D1Database,
  userId: string,
  token: string,
  metadata: {
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<string> {
  const sessionId = crypto.randomUUID();
  const tokenHash = hashToken(token);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  await executeMutation(
    db,
    `INSERT INTO sessions (id, user_id, token_hash, ip_address, user_agent, created_at, expires_at, last_active_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, userId, tokenHash, metadata.ipAddress || null, metadata.userAgent || null, now, expiresAt, now]
  );

  return sessionId;
}

/**
 * Get a session by ID
 */
export async function getSession(
  db: D1Database,
  sessionId: string
): Promise<Session | null> {
  const session = await executeQueryFirst<Session>(
    db,
    'SELECT * FROM sessions WHERE id = ? AND is_active = 1',
    [sessionId]
  );

  return session || null;
}

/**
 * Validate a session (check if active and not expired)
 */
export async function validateSession(
  db: D1Database,
  sessionId: string
): Promise<boolean> {
  const session = await getSession(db, sessionId);

  if (!session) {
    return false;
  }

  // Check if expired
  const now = new Date();
  const expiresAt = new Date(session.expiresAt);

  if (now > expiresAt) {
    // Automatically revoke expired session
    await revokeSession(db, sessionId);
    return false;
  }

  // Update last active time
  await executeMutation(
    db,
    'UPDATE sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?',
    [sessionId]
  );

  return true;
}

/**
 * Revoke a single session
 */
export async function revokeSession(
  db: D1Database,
  sessionId: string
): Promise<void> {
  await executeMutation(
    db,
    'UPDATE sessions SET is_active = 0 WHERE id = ?',
    [sessionId]
  );
}

/**
 * Revoke all sessions for a user
 */
export async function revokeAllUserSessions(
  db: D1Database,
  userId: string
): Promise<void> {
  await executeMutation(
    db,
    'UPDATE sessions SET is_active = 0 WHERE user_id = ?',
    [userId]
  );
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(
  db: D1Database,
  userId: string
): Promise<Session[]> {
  const sessions = await executeQuery<Session>(
    db,
    `SELECT * FROM sessions 
     WHERE user_id = ? AND is_active = 1 
     ORDER BY last_active_at DESC`,
    [userId]
  );

  return sessions;
}

/**
 * Cleanup expired sessions (run periodically)
 */
export async function cleanupExpiredSessions(
  db: D1Database
): Promise<number> {
  const result = await executeMutation(
    db,
    'UPDATE sessions SET is_active = 0 WHERE expires_at < CURRENT_TIMESTAMP AND is_active = 1'
  );

  // Note: D1 doesn't return affected rows count easily
  // For monitoring, you could query before/after
  return 0;
}
```

---

### 4. D1 Client Helper (`src/lib/d1-client.ts`)

```typescript
import { NextRequest } from 'next/server';

/**
 * Get D1 database from request context
 */
export function getDatabase(request: NextRequest): D1Database {
  // @ts-expect-error - Cloudflare binding
  const db = request.env?.quizmaker_database;
  
  if (!db) {
    throw new Error('Database not available');
  }
  
  return db as D1Database;
}

/**
 * Execute a query and return all results
 */
export async function executeQuery<T>(
  db: D1Database,
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const stmt = db.prepare(sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  const { results } = await bound.all<T>();
  return results || [];
}

/**
 * Execute a query and return first result
 */
export async function executeQueryFirst<T>(
  db: D1Database,
  sql: string,
  params: any[] = []
): Promise<T | null> {
  const results = await executeQuery<T>(db, sql, params);
  return results[0] || null;
}

/**
 * Execute a mutation (INSERT, UPDATE, DELETE)
 */
export async function executeMutation(
  db: D1Database,
  sql: string,
  params: any[] = []
): Promise<void> {
  const stmt = db.prepare(sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  await bound.run();
}
```

---

### 5. Signup API Route (`src/app/api/auth/signup/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { createToken } from '@/lib/auth/jwt';
import { createSession } from '@/lib/auth/session';
import { getDatabase, executeQueryFirst, executeMutation } from '@/lib/d1-client';

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
        { 
          error: 'Password does not meet requirements', 
          details: passwordValidation.errors 
        },
        { status: 400 }
      );
    }

    // Get database
    const db = getDatabase(request);

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
```

---

### 6. Login API Route (`src/app/api/auth/login/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/auth/password';
import { createToken } from '@/lib/auth/jwt';
import { createSession } from '@/lib/auth/session';
import { getDatabase, executeQueryFirst, executeMutation } from '@/lib/d1-client';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  is_active: number;
}

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
    const user = await executeQueryFirst<UserRow>(
      db,
      `SELECT id, email, password_hash, full_name, is_active
       FROM users
       WHERE email = ?`,
      [email.toLowerCase()]
    );

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

    // Update last login timestamp
    await executeMutation(
      db,
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    // Generate temporary token for session creation
    const tempToken = crypto.randomUUID();

    // Create session
    const sessionId = await createSession(db, user.id, tempToken, {
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    // Generate JWT token with session ID
    const token = await createToken({
      sessionId,
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

### 7. Logout API Route (`src/app/api/auth/logout/route.ts`)

```typescript
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
        const db = getDatabase(request);
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
```

---

### 8. Logout All Devices API Route (`src/app/api/auth/logout-all/route.ts`)

```typescript
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
    const db = getDatabase(request);
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
```

---

### 9. Get Current User API Route (`src/app/api/auth/me/route.ts`)

```typescript
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
    const db = getDatabase(request);
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
```

---

### 10. Get Active Sessions API Route (`src/app/api/auth/sessions/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { getUserSessions, revokeSession } from '@/lib/auth/session';
import { getDatabase } from '@/lib/d1-client';

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
    const db = getDatabase(request);

    const sessions = await getUserSessions(db, userId);

    // Format sessions for frontend
    const formattedSessions = sessions.map((session) => ({
      id: session.id,
      isCurrent: session.id === currentSessionId,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      // Parse user agent for better display (you can use a library like ua-parser-js)
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
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    const db = getDatabase(request);

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

/**
 * Simple user agent parser (you can use ua-parser-js library for better results)
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
```

---

### 11. Middleware (`src/middleware.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { validateSession } from '@/lib/auth/session';
import { getDatabase } from '@/lib/d1-client';

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
      // Verify token
      const { sessionId } = await verifyToken(token);

      // Validate session is still active
      const db = getDatabase(request);
      const isValidSession = await validateSession(db, sessionId);

      if (!isValidSession) {
        // Session invalid - redirect to login
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.delete('auth-token');
        return response;
      }

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
      const { sessionId } = await verifyToken(token);
      
      // Validate session
      const db = getDatabase(request);
      const isValidSession = await validateSession(db, sessionId);

      if (isValidSession) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      } else {
        // Invalid session - clear cookie and allow access to auth page
        const response = NextResponse.next();
        response.cookies.delete('auth-token');
        return response;
      }
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

### 9. Auth Context (`src/lib/auth/auth-context.tsx`)

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

## Testing Checklist

### Manual Testing for MVP

After implementing authentication, test these scenarios:

#### Signup Flow
- [ ] Valid signup creates new user
- [ ] Duplicate email shows error
- [ ] Weak password rejected (too short, no uppercase, etc.)
- [ ] Invalid email format rejected
- [ ] Missing fields show validation errors
- [ ] Successful signup redirects to dashboard
- [ ] User is automatically logged in after signup

#### Login Flow
- [ ] Valid credentials log in successfully
- [ ] Invalid email shows generic error
- [ ] Invalid password shows generic error
- [ ] Successful login redirects to dashboard
- [ ] Login sets HTTP-only cookie

#### Protected Routes
- [ ] Accessing `/dashboard` without login redirects to `/login`
- [ ] After login, can access `/dashboard`
- [ ] Visiting `/login` when logged in redirects to `/dashboard`
- [ ] Visiting `/signup` when logged in redirects to `/dashboard`

#### Logout
- [ ] Logout clears authentication
- [ ] After logout, redirected to login page
- [ ] After logout, cannot access protected routes

#### Session Persistence
- [ ] Refresh page - user stays logged in
- [ ] Close and reopen browser - user stays logged in (for 7 days)
- [ ] After 7 days, token expires and user must log in again

#### Session Management
- [ ] Logout revokes current session
- [ ] After logout, cannot access protected routes
- [ ] Logout all devices revokes all sessions
- [ ] After logout all, user must re-login on all devices
- [ ] Can view list of active sessions
- [ ] Can revoke individual sessions
- [ ] Current session is marked in session list
- [ ] Session shows device info and last active time

#### Error Handling
- [ ] Network errors show appropriate message
- [ ] Server errors (500) show appropriate message
- [ ] Validation errors show specific field errors

---

## Environment Checklist

### Before You Start Coding

- [ ] Install dependencies: `npm install bcryptjs @types/bcryptjs jose`
- [ ] Add `JWT_SECRET` to `.dev.vars`
- [ ] Create users and sessions table migration
- [ ] Apply migration locally: `npx wrangler d1 migrations apply quizmaker-database --local`
- [ ] Verify database structure: `npx wrangler d1 execute quizmaker-database --local --command "SELECT * FROM sqlite_master WHERE type='table'"`
- [ ] Verify both tables exist: users and sessions

### After Implementation

- [ ] Test all flows manually (use checklist above)
- [ ] Add JWT_SECRET to Cloudflare secrets for production
- [ ] Apply migrations to production D1 database (when ready)
- [ ] Test on production environment

---

## Common Issues & Solutions

### Issue: "Database not available"
**Solution:** Make sure `wrangler.jsonc` has the D1 binding:
```json
{
  "d1_databases": [
    {
      "binding": "quizmaker_database",
      "database_name": "quizmaker-database",
      "database_id": "c5e42623-2f0a-481f-9b14-9294bb18bdf0"
    }
  ]
}
```

### Issue: "Invalid JWT signature"
**Solution:** JWT_SECRET must be the same across all environments. Don't change it after users sign up.

### Issue: "bcrypt not working in Cloudflare Workers"
**Solution:** Use `bcryptjs` (JavaScript implementation) instead of `bcrypt` (native module).

### Issue: "Cookie not being set"
**Solution:** Check `secure` flag. In development (HTTP), set `secure: false`. In production (HTTPS), set `secure: true`.

---

## Next Steps After MVP

Once MVP authentication is working, consider adding:

1. **Password Reset** (Phase 2)
   - Forgot password link
   - Email with reset token
   - Reset password form

2. **Email Verification** (Phase 2)
   - Send verification email on signup
   - Verify email before full access
   - Resend verification email

3. **Account Settings** (Phase 2)
   - Edit profile (name, email)
   - Change password
   - Delete account

4. **Rate Limiting** (Phase 2)
   - Track failed login attempts
   - Temporary account lockout
   - CAPTCHA after multiple failures

5. **OAuth Providers** (Phase 3)
   - Google Sign-In
   - Microsoft Sign-In
   - Link multiple providers

---

## Summary: MVP Implementation

### What You're Building
✅ Email/Password signup
✅ Email/Password login
✅ Logout (single device)
✅ Logout all devices
✅ Session tracking in database
✅ JWT tokens in HTTP-only cookies
✅ Protected routes with session validation
✅ Active sessions management
✅ Basic auth UI

### What You're NOT Building (Yet)
❌ Email verification
❌ Password reset
❌ Rate limiting (login attempts)
❌ OAuth/SSO
❌ Advanced session analytics

### Implementation Approach
**Sequential execution** - Each step builds on previous steps. Can be completed in one sprint session with proper orchestration.

### Dependencies
- `bcryptjs` - Password hashing
- `jose` - JWT for Edge
- `zod` - Validation (already installed)

### Database
- TWO tables: `users` and `sessions`

### Key Features
- **Session Tracking**: Know which devices are logged in
- **Logout All**: Revoke all sessions if device is lost
- **Security**: Sessions can be revoked immediately
- **Monitoring**: Track last active time, IP, device info

---

**Status:** Ready for MVP implementation  
**Focus:** Simple, secure, functional authentication  
**Goal:** Get users logged in so they can create MCQs  
**Last Updated:** December 17, 2025
