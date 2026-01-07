# Authentication Feature - SDLC Implementation Checklist

## Overview

This is the **master implementation checklist** for the Basic Authentication feature in QuizMaker. As orchestrator, you can track progress through each phase of the Software Development Life Cycle (SDLC).

**Feature:** Email/Password Authentication with Session Tracking  
**Status:** Not Started  
**Last Updated:** December 17, 2025

---

## 📋 Table of Contents

1. [Phase 1: Planning & Setup](#phase-1-planning--setup)
2. [Phase 2: Database Layer](#phase-2-database-layer)
3. [Phase 3: Backend/API Layer](#phase-3-backendapi-layer)
4. [Phase 4: Frontend/UI Layer](#phase-4-frontendui-layer)
5. [Phase 5: Integration & Testing](#phase-5-integration--testing)
6. [Phase 6: Deployment](#phase-6-deployment)
7. [Phase 7: Post-Deployment](#phase-7-post-deployment)

---

## Phase 1: Planning & Setup

### 1.1 Environment Setup

- [ ] **Generate JWT Secret**
  - [ ] Run command: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  - [ ] Copy generated secret
  - [ ] Store securely (will be added to `.dev.vars`)

- [ ] **Create/Update `.dev.vars` file**
  - [ ] Verify file exists in project root
  - [ ] Add `JWT_SECRET=<generated-secret>`
  - [ ] Verify `NEXTJS_ENV=development` exists
  - [ ] Confirm file is in `.gitignore`

- [ ] **Verify Project Configuration**
  - [ ] Check `wrangler.jsonc` has D1 database binding
  - [ ] Confirm database name: `quizmaker-database`
  - [ ] Confirm binding name: `quizmaker_database`
  - [ ] Verify database ID is present

### 1.2 Dependencies Installation

- [ ] **Install Authentication Dependencies**
  - [ ] Run: `npm install bcryptjs @types/bcryptjs`
  - [ ] Run: `npm install jose`
  - [ ] Verify installations in `package.json`
  - [ ] Run: `npm install` to ensure lock file is updated

- [ ] **Verify Existing Dependencies**
  - [ ] Confirm `zod` is installed (for validation)
  - [ ] Confirm `next` is installed
  - [ ] Confirm TypeScript types are present

### 1.3 Documentation Review

- [ ] **Review Implementation Plan**
  - [ ] Read `docs/BASIC_AUTHENTICATION.md` completely
  - [ ] Understand session management approach
  - [ ] Review database schema design
  - [ ] Note security best practices

**Phase 1 Completion Criteria:**
✅ All dependencies installed  
✅ Environment variables configured  
✅ Project structure verified  
✅ Ready to begin implementation

---

## Phase 2: Database Layer

### 2.1 Migration Creation

- [ ] **Create Database Migration File**
  - [ ] Run: `npx wrangler d1 migrations create quizmaker-database create_auth_tables`
  - [ ] Verify migration file created in `migrations/` directory
  - [ ] Note migration file name (e.g., `0001_create_auth_tables.sql`)

### 2.2 Write Migration SQL

- [ ] **Create Users Table**
  - [ ] Add `CREATE TABLE users` statement
  - [ ] Add columns: id, email, password_hash, full_name
  - [ ] Add columns: is_active, created_at, updated_at, last_login_at
  - [ ] Add `UNIQUE` constraint on email
  - [ ] Add `DEFAULT` values for timestamps
  - [ ] Use correct ID generation: `lower(hex(randomblob(16)))`

- [ ] **Create Users Indexes**
  - [ ] Add index: `idx_users_email` on email column
  - [ ] Add index: `idx_users_active` on is_active column

- [ ] **Create Sessions Table**
  - [ ] Add `CREATE TABLE sessions` statement
  - [ ] Add columns: id, user_id, token_hash
  - [ ] Add columns: ip_address, user_agent
  - [ ] Add columns: created_at, expires_at, last_active_at, is_active
  - [ ] Add `FOREIGN KEY` constraint to users table
  - [ ] Add `ON DELETE CASCADE` for user deletion
  - [ ] Add `UNIQUE` constraint on token_hash

- [ ] **Create Sessions Indexes**
  - [ ] Add index: `idx_sessions_token` on token_hash
  - [ ] Add index: `idx_sessions_expires` on expires_at
  - [ ] Add index: `idx_sessions_user` on user_id
  - [ ] Add index: `idx_sessions_active` on (user_id, is_active)

### 2.3 Apply Migration Locally

- [ ] **Run Migration**
  - [ ] Run: `npx wrangler d1 migrations apply quizmaker-database --local`
  - [ ] Confirm migration applied successfully
  - [ ] Check for any SQL errors

### 2.4 Verify Database Structure

- [ ] **Verify Tables Created**
  - [ ] Run: `npx wrangler d1 execute quizmaker-database --local --command "SELECT name FROM sqlite_master WHERE type='table'"`
  - [ ] Confirm `users` table exists
  - [ ] Confirm `sessions` table exists

- [ ] **Verify Users Table Schema**
  - [ ] Run: `npx wrangler d1 execute quizmaker-database --local --command "PRAGMA table_info(users)"`
  - [ ] Verify all columns present
  - [ ] Verify data types correct

- [ ] **Verify Sessions Table Schema**
  - [ ] Run: `npx wrangler d1 execute quizmaker-database --local --command "PRAGMA table_info(sessions)"`
  - [ ] Verify all columns present
  - [ ] Verify foreign key exists

- [ ] **Verify Indexes Created**
  - [ ] Run: `npx wrangler d1 execute quizmaker-database --local --command "SELECT name FROM sqlite_master WHERE type='index'"`
  - [ ] Confirm all 6 indexes exist (2 for users, 4 for sessions)

**Phase 2 Completion Criteria:**
✅ Migration file created  
✅ Both tables created successfully  
✅ All indexes in place  
✅ Database structure verified  
✅ Ready for backend implementation

---

## Phase 3: Backend/API Layer

### 3.1 Core Utilities

#### 3.1.1 D1 Client Helper

- [ ] **Create `src/lib/d1-client.ts`**
  - [ ] Create directory: `src/lib/` if not exists
  - [ ] Create file with D1 helper functions
  - [ ] Implement `getDatabase(request)` function
  - [ ] Implement `executeQuery<T>()` function
  - [ ] Implement `executeQueryFirst<T>()` function
  - [ ] Implement `executeMutation()` function
  - [ ] Add TypeScript types
  - [ ] Add error handling

- [ ] **Test D1 Client (manual verification)**
  - [ ] Verify TypeScript compiles
  - [ ] Check for linting errors
  - [ ] Verify exports are correct

#### 3.1.2 Password Utilities

- [ ] **Create `src/lib/auth/password.ts`**
  - [ ] Create directory: `src/lib/auth/`
  - [ ] Import bcryptjs
  - [ ] Implement `hashPassword()` function
  - [ ] Implement `verifyPassword()` function
  - [ ] Implement `validatePasswordStrength()` function
  - [ ] Set SALT_ROUNDS = 10
  - [ ] Add password requirements validation (min 8 chars, uppercase, lowercase, number)
  - [ ] Add TypeScript types
  - [ ] Export all functions

- [ ] **Verify Password Utilities**
  - [ ] TypeScript compiles without errors
  - [ ] All exports correct
  - [ ] No linting errors

#### 3.1.3 JWT Utilities

- [ ] **Create `src/lib/auth/jwt.ts`**
  - [ ] Import jose library
  - [ ] Define JWTPayload interface (sessionId, userId, email)
  - [ ] Implement `createToken()` function
  - [ ] Implement `verifyToken()` function
  - [ ] Use HS256 algorithm
  - [ ] Set token expiry to 7 days
  - [ ] Handle JWT_SECRET from environment
  - [ ] Add proper error handling
  - [ ] Export types and functions

- [ ] **Verify JWT Utilities**
  - [ ] TypeScript compiles without errors
  - [ ] JWT_SECRET accessed correctly
  - [ ] No linting errors

#### 3.1.4 Session Utilities

- [ ] **Create `src/lib/auth/session.ts`**
  - [ ] Import d1-client helpers
  - [ ] Import crypto for hashing
  - [ ] Define Session interface
  - [ ] Implement `hashToken()` helper function
  - [ ] Implement `createSession()` function
  - [ ] Implement `getSession()` function
  - [ ] Implement `validateSession()` function
  - [ ] Implement `revokeSession()` function
  - [ ] Implement `revokeAllUserSessions()` function
  - [ ] Implement `getUserSessions()` function
  - [ ] Implement `cleanupExpiredSessions()` function
  - [ ] Set session expiry to 7 days
  - [ ] Add last_active_at update on validation
  - [ ] Export all functions and types

- [ ] **Verify Session Utilities**
  - [ ] TypeScript compiles without errors
  - [ ] All imports resolved
  - [ ] No linting errors

### 3.2 API Routes

#### 3.2.1 Signup Route

- [ ] **Create `src/app/api/auth/signup/route.ts`**
  - [ ] Create directories: `src/app/api/auth/signup/`
  - [ ] Import required utilities (password, jwt, session, d1-client)
  - [ ] Implement POST handler
  - [ ] Validate input fields (email, password, fullName)
  - [ ] Validate email format with regex
  - [ ] Validate password strength
  - [ ] Check if email already exists in database
  - [ ] Hash password using bcrypt
  - [ ] Generate unique user ID
  - [ ] Insert user into database
  - [ ] Generate temp token for session
  - [ ] Create session with IP and user agent
  - [ ] Generate JWT with session ID
  - [ ] Set HTTP-only cookie
  - [ ] Return success response with user data
  - [ ] Add comprehensive error handling
  - [ ] Return appropriate HTTP status codes

- [ ] **Verify Signup Route**
  - [ ] TypeScript compiles
  - [ ] All imports resolved
  - [ ] No linting errors
  - [ ] Route exports POST function

#### 3.2.2 Login Route

- [ ] **Create `src/app/api/auth/login/route.ts`**
  - [ ] Create directory: `src/app/api/auth/login/`
  - [ ] Import required utilities
  - [ ] Define UserRow interface
  - [ ] Implement POST handler
  - [ ] Validate input (email, password required)
  - [ ] Find user by email in database
  - [ ] Return generic error if user not found
  - [ ] Check if account is active
  - [ ] Verify password with bcrypt
  - [ ] Update last_login_at timestamp
  - [ ] Generate temp token for session
  - [ ] Create session with metadata
  - [ ] Generate JWT with session ID
  - [ ] Set HTTP-only cookie
  - [ ] Return success response with user data
  - [ ] Add error handling
  - [ ] Use generic error messages (security)

- [ ] **Verify Login Route**
  - [ ] TypeScript compiles
  - [ ] All imports resolved
  - [ ] No linting errors

#### 3.2.3 Logout Route

- [ ] **Create `src/app/api/auth/logout/route.ts`**
  - [ ] Create directory: `src/app/api/auth/logout/`
  - [ ] Import jwt, session utilities
  - [ ] Implement POST handler
  - [ ] Get token from cookie
  - [ ] Verify JWT and extract session ID
  - [ ] Revoke session in database
  - [ ] Clear HTTP-only cookie
  - [ ] Return success response
  - [ ] Handle errors gracefully (continue logout even if token invalid)

- [ ] **Verify Logout Route**
  - [ ] TypeScript compiles
  - [ ] No linting errors

#### 3.2.4 Logout All Devices Route

- [ ] **Create `src/app/api/auth/logout-all/route.ts`**
  - [ ] Create directory: `src/app/api/auth/logout-all/`
  - [ ] Import jwt, session utilities
  - [ ] Implement POST handler
  - [ ] Get token from cookie
  - [ ] Return 401 if not authenticated
  - [ ] Verify JWT and extract user ID
  - [ ] Revoke all user sessions in database
  - [ ] Clear HTTP-only cookie
  - [ ] Return success response
  - [ ] Add error handling

- [ ] **Verify Logout All Route**
  - [ ] TypeScript compiles
  - [ ] No linting errors

#### 3.2.5 Get Current User Route

- [ ] **Create `src/app/api/auth/me/route.ts`**
  - [ ] Create directory: `src/app/api/auth/me/`
  - [ ] Import jwt, session, d1-client utilities
  - [ ] Define UserRow interface
  - [ ] Implement GET handler
  - [ ] Get token from cookie
  - [ ] Return 401 if no token
  - [ ] Verify JWT and extract session ID and user ID
  - [ ] Validate session is still active
  - [ ] Clear cookie and return 401 if session invalid
  - [ ] Fetch user from database
  - [ ] Return 404 if user not found or inactive
  - [ ] Return success with user data
  - [ ] Add error handling

- [ ] **Verify Get Current User Route**
  - [ ] TypeScript compiles
  - [ ] No linting errors

#### 3.2.6 Active Sessions Route (Optional)

- [ ] **Create `src/app/api/auth/sessions/route.ts`**
  - [ ] Create directory: `src/app/api/auth/sessions/`
  - [ ] Import jwt, session utilities
  - [ ] Implement GET handler (list sessions)
  - [ ] Verify authentication
  - [ ] Fetch all active sessions for user
  - [ ] Parse user agent for device type
  - [ ] Mark current session
  - [ ] Return formatted sessions list
  - [ ] Implement DELETE handler (revoke session)
  - [ ] Verify session belongs to user (security)
  - [ ] Revoke specified session
  - [ ] Return success response
  - [ ] Add helper: `parseUserAgent()` function
  - [ ] Add error handling for both handlers

- [ ] **Verify Sessions Route**
  - [ ] TypeScript compiles
  - [ ] Both GET and DELETE exported
  - [ ] No linting errors

### 3.3 Middleware

- [ ] **Create `src/middleware.ts`**
  - [ ] Create file in `src/` directory
  - [ ] Import jwt, session utilities
  - [ ] Define protectedPaths array: ['/dashboard', '/mcqs']
  - [ ] Define authPaths array: ['/login', '/signup']
  - [ ] Implement middleware function
  - [ ] Check if path is protected
  - [ ] Check if path is auth page
  - [ ] For protected paths:
    - [ ] Redirect to login if no token
    - [ ] Verify JWT
    - [ ] Validate session in database
    - [ ] Redirect to login if invalid
    - [ ] Allow access if valid
  - [ ] For auth paths:
    - [ ] Redirect to dashboard if already authenticated
    - [ ] Clear invalid cookies
  - [ ] Export middleware config with matcher
  - [ ] Exclude API routes, static files from matching

- [ ] **Verify Middleware**
  - [ ] TypeScript compiles
  - [ ] Config exported correctly
  - [ ] No linting errors

### 3.4 Backend Verification

- [ ] **Verify All API Routes**
  - [ ] All files created in correct locations
  - [ ] All imports resolve correctly
  - [ ] TypeScript compiles without errors
  - [ ] No linting errors in any file
  - [ ] All functions exported correctly

- [ ] **Check File Structure**
  ```
  src/
  ├── lib/
  │   ├── d1-client.ts
  │   └── auth/
  │       ├── password.ts
  │       ├── jwt.ts
  │       └── session.ts
  ├── app/
  │   └── api/
  │       └── auth/
  │           ├── signup/route.ts
  │           ├── login/route.ts
  │           ├── logout/route.ts
  │           ├── logout-all/route.ts
  │           ├── me/route.ts
  │           └── sessions/route.ts
  └── middleware.ts
  ```

**Phase 3 Completion Criteria:**
✅ All utility files created  
✅ All API routes implemented  
✅ Middleware configured  
✅ TypeScript compiles successfully  
✅ No linting errors  
✅ Ready for frontend implementation

---

## Phase 4: Frontend/UI Layer

### 4.1 Auth Context

- [ ] **Create `src/lib/auth/auth-context.tsx`**
  - [ ] Mark as 'use client' component
  - [ ] Import React hooks (createContext, useContext, useState, useEffect)
  - [ ] Define User interface
  - [ ] Define AuthContextType interface
  - [ ] Create AuthContext
  - [ ] Implement AuthProvider component
  - [ ] Add user state
  - [ ] Add loading state
  - [ ] Implement checkAuth() function (calls /api/auth/me)
  - [ ] Implement login() function
  - [ ] Implement signup() function
  - [ ] Implement logout() function
  - [ ] Call checkAuth() on mount
  - [ ] Implement useAuth() hook
  - [ ] Add error handling
  - [ ] Export AuthProvider and useAuth

- [ ] **Verify Auth Context**
  - [ ] TypeScript compiles
  - [ ] No linting errors
  - [ ] Exports correct

### 4.2 Signup Page

- [ ] **Create `src/app/signup/page.tsx`**
  - [ ] Create directory: `src/app/signup/`
  - [ ] Mark as 'use client' if using hooks
  - [ ] Import shadcn/ui components (Card, Button, Input, Label, etc.)
  - [ ] Import useAuth hook
  - [ ] Import useRouter from next/navigation
  - [ ] Add form state for: fullName, email, password, confirmPassword
  - [ ] Add error state
  - [ ] Add loading state
  - [ ] Implement form validation:
    - [ ] Email format validation
    - [ ] Password strength validation
    - [ ] Passwords match validation
    - [ ] All fields required
  - [ ] Implement handleSubmit function
  - [ ] Call signup from useAuth
  - [ ] Handle errors and display messages
  - [ ] Redirect to /dashboard on success
  - [ ] Show password strength indicator
  - [ ] Add link to login page
  - [ ] Style with Tailwind CSS
  - [ ] Make responsive

- [ ] **Verify Signup Page**
  - [ ] TypeScript compiles
  - [ ] No linting errors
  - [ ] Uses shadcn/ui components
  - [ ] Accessible (ARIA labels)

### 4.3 Login Page

- [ ] **Create `src/app/login/page.tsx`**
  - [ ] Create directory: `src/app/login/`
  - [ ] Mark as 'use client' if using hooks
  - [ ] Import shadcn/ui components
  - [ ] Import useAuth hook
  - [ ] Import useRouter
  - [ ] Add form state for: email, password
  - [ ] Add error state
  - [ ] Add loading state
  - [ ] Implement form validation
  - [ ] Implement handleSubmit function
  - [ ] Call login from useAuth
  - [ ] Handle errors and display messages
  - [ ] Redirect to /dashboard on success
  - [ ] Handle redirect query param (if user was redirected from protected page)
  - [ ] Add link to signup page
  - [ ] Add "Forgot password?" placeholder (future)
  - [ ] Style with Tailwind CSS
  - [ ] Make responsive

- [ ] **Verify Login Page**
  - [ ] TypeScript compiles
  - [ ] No linting errors
  - [ ] Uses shadcn/ui components
  - [ ] Accessible

### 4.4 Dashboard Page

- [ ] **Create `src/app/dashboard/page.tsx`**
  - [ ] Create directory: `src/app/dashboard/`
  - [ ] Mark as 'use client' if using hooks
  - [ ] Import shadcn/ui components
  - [ ] Import useAuth hook
  - [ ] Show loading state while checking auth
  - [ ] Display welcome message with user's name
  - [ ] Add logout button
  - [ ] Add navigation links (to MCQs, etc.)
  - [ ] Show user email
  - [ ] Add basic dashboard layout
  - [ ] Call logout function on button click
  - [ ] Redirect to /login after logout
  - [ ] Style with Tailwind CSS
  - [ ] Make responsive

- [ ] **Verify Dashboard Page**
  - [ ] TypeScript compiles
  - [ ] No linting errors
  - [ ] Protected by middleware
  - [ ] Displays user data correctly

### 4.5 Root Layout Update

- [ ] **Update `src/app/layout.tsx`**
  - [ ] Import AuthProvider
  - [ ] Wrap children with AuthProvider
  - [ ] Verify doesn't break existing layout
  - [ ] Ensure metadata still exported

- [ ] **Verify Layout Update**
  - [ ] TypeScript compiles
  - [ ] No linting errors
  - [ ] Auth context available throughout app

### 4.6 Optional: Session Management Page

- [ ] **Create `src/app/dashboard/sessions/page.tsx` (Optional)**
  - [ ] Create directory: `src/app/dashboard/sessions/`
  - [ ] Mark as 'use client'
  - [ ] Import shadcn/ui components (Table, Button, Badge)
  - [ ] Fetch sessions from /api/auth/sessions
  - [ ] Display sessions in table:
    - [ ] Device type
    - [ ] IP address
    - [ ] Last active time
    - [ ] Current session badge
  - [ ] Add "Logout" button for each session
  - [ ] Add "Logout All Devices" button
  - [ ] Implement session revoke functionality
  - [ ] Show loading states
  - [ ] Handle errors
  - [ ] Style with Tailwind CSS

- [ ] **Verify Sessions Page** (if implemented)
  - [ ] TypeScript compiles
  - [ ] No linting errors
  - [ ] Sessions display correctly

### 4.7 Frontend Verification

- [ ] **Check All Pages Created**
  ```
  src/app/
  ├── layout.tsx (updated)
  ├── signup/page.tsx
  ├── login/page.tsx
  └── dashboard/
      ├── page.tsx
      └── sessions/page.tsx (optional)
  ```

- [ ] **Visual Verification**
  - [ ] All pages render without errors
  - [ ] Styling looks good
  - [ ] Responsive on mobile
  - [ ] Forms are usable
  - [ ] Error messages display correctly
  - [ ] Loading states show appropriately

**Phase 4 Completion Criteria:**
✅ Auth context created  
✅ All pages implemented  
✅ Layout updated with provider  
✅ No TypeScript errors  
✅ No linting errors  
✅ UI is functional and styled  
✅ Ready for testing

---

## Phase 5: Integration & Testing

### 5.1 Local Development Testing

- [ ] **Start Development Server**
  - [ ] Run: `npm run dev`
  - [ ] Verify server starts without errors
  - [ ] Open browser to `http://localhost:3000`

### 5.2 Signup Flow Testing

- [ ] **Test Valid Signup**
  - [ ] Navigate to `/signup`
  - [ ] Enter valid full name
  - [ ] Enter valid email (e.g., `teacher@school.com`)
  - [ ] Enter strong password
  - [ ] Confirm password matches
  - [ ] Click submit
  - [ ] Verify redirected to `/dashboard`
  - [ ] Verify user name displayed correctly
  - [ ] Check browser dev tools: cookie `auth-token` set

- [ ] **Test Signup Validations**
  - [ ] Try empty fields → Show error
  - [ ] Try invalid email → Show error
  - [ ] Try weak password (< 8 chars) → Show error
  - [ ] Try password without uppercase → Show error
  - [ ] Try password without number → Show error
  - [ ] Try mismatched passwords → Show error
  - [ ] Try duplicate email → Show "Email already registered" error

- [ ] **Verify Database After Signup**
  - [ ] Run: `npx wrangler d1 execute quizmaker-database --local --command "SELECT * FROM users"`
  - [ ] Verify user created
  - [ ] Verify password is hashed (not plain text)
  - [ ] Verify email is lowercase
  - [ ] Run: `npx wrangler d1 execute quizmaker-database --local --command "SELECT * FROM sessions"`
  - [ ] Verify session created
  - [ ] Verify expires_at is 7 days in future

### 5.3 Login Flow Testing

- [ ] **Test Valid Login**
  - [ ] Logout if logged in
  - [ ] Navigate to `/login`
  - [ ] Enter correct email
  - [ ] Enter correct password
  - [ ] Click submit
  - [ ] Verify redirected to `/dashboard`
  - [ ] Verify user data displayed
  - [ ] Check cookie set

- [ ] **Test Login Validations**
  - [ ] Try empty email → Show error
  - [ ] Try empty password → Show error
  - [ ] Try invalid email → Show generic error
  - [ ] Try wrong password → Show generic error (same as invalid email)
  - [ ] Verify error message doesn't reveal if email exists

- [ ] **Test Redirect After Login**
  - [ ] Try accessing `/dashboard` while logged out
  - [ ] Verify redirected to `/login?redirect=/dashboard`
  - [ ] Login successfully
  - [ ] Verify redirected back to `/dashboard`

### 5.4 Session Persistence Testing

- [ ] **Test Page Refresh**
  - [ ] Login successfully
  - [ ] Refresh page (F5)
  - [ ] Verify still logged in
  - [ ] Verify user data still displayed

- [ ] **Test Browser Close/Reopen**
  - [ ] Login successfully
  - [ ] Close browser completely
  - [ ] Reopen browser
  - [ ] Navigate to `/dashboard`
  - [ ] Verify still logged in

- [ ] **Test Multiple Tabs**
  - [ ] Login in Tab 1
  - [ ] Open Tab 2, navigate to `/dashboard`
  - [ ] Verify logged in on Tab 2
  - [ ] Logout in Tab 1
  - [ ] Refresh Tab 2
  - [ ] Verify logged out on Tab 2

### 5.5 Logout Testing

- [ ] **Test Single Device Logout**
  - [ ] Login successfully
  - [ ] Click logout button
  - [ ] Verify redirected to `/login`
  - [ ] Try accessing `/dashboard`
  - [ ] Verify redirected to `/login` (not authenticated)
  - [ ] Check browser dev tools: cookie cleared

- [ ] **Test Logout All Devices**
  - [ ] Login on Browser 1
  - [ ] Login on Browser 2 (or incognito)
  - [ ] On Browser 1, trigger "Logout All Devices"
  - [ ] Verify logged out on Browser 1
  - [ ] Try accessing protected route on Browser 2
  - [ ] Verify also logged out on Browser 2

### 5.6 Protected Routes Testing

- [ ] **Test Middleware Protection**
  - [ ] Logout completely
  - [ ] Try accessing `/dashboard` → Redirected to `/login`
  - [ ] Try accessing `/mcqs` → Redirected to `/login`
  - [ ] Login successfully
  - [ ] Navigate to `/dashboard` → Access granted
  - [ ] Navigate to `/mcqs` → Access granted (even if page doesn't exist yet)

- [ ] **Test Auth Page Redirects**
  - [ ] Login successfully
  - [ ] Try navigating to `/login` → Redirected to `/dashboard`
  - [ ] Try navigating to `/signup` → Redirected to `/dashboard`
  - [ ] Logout
  - [ ] Navigate to `/login` → Access granted
  - [ ] Navigate to `/signup` → Access granted

### 5.7 Session Management Testing (if implemented)

- [ ] **Test Sessions List**
  - [ ] Login successfully
  - [ ] Navigate to sessions page
  - [ ] Verify current session listed
  - [ ] Verify marked as "Current Session"
  - [ ] Verify device info shown
  - [ ] Verify last active time shown

- [ ] **Test Individual Session Revoke**
  - [ ] Login on Browser 1
  - [ ] Login on Browser 2
  - [ ] On Browser 1, view sessions list
  - [ ] Revoke Browser 2's session
  - [ ] On Browser 2, try accessing protected page
  - [ ] Verify logged out on Browser 2
  - [ ] Verify Browser 1 still logged in

### 5.8 Error Handling Testing

- [ ] **Test Network Errors**
  - [ ] Stop dev server
  - [ ] Try to login
  - [ ] Verify error message displayed
  - [ ] Restart server
  - [ ] Verify can login again

- [ ] **Test API Errors**
  - [ ] Temporarily break an API route (syntax error)
  - [ ] Try using that feature
  - [ ] Verify error message displayed (not crash)
  - [ ] Fix API route
  - [ ] Verify works again

### 5.9 Security Testing

- [ ] **Verify Password Security**
  - [ ] Create user
  - [ ] Check database: `SELECT password_hash FROM users`
  - [ ] Verify password is hashed (not plain text)
  - [ ] Verify hash starts with `$2a$` or `$2b$` (bcrypt)

- [ ] **Verify JWT Security**
  - [ ] Login and get cookie from browser dev tools
  - [ ] Try to decode JWT at jwt.io
  - [ ] Verify payload contains: sessionId, userId, email
  - [ ] Verify has expiration date

- [ ] **Verify Cookie Security**
  - [ ] Login successfully
  - [ ] Open browser dev tools → Application → Cookies
  - [ ] Verify `auth-token` cookie exists
  - [ ] Verify `HttpOnly` is checked (JavaScript can't access)
  - [ ] Verify `SameSite` is set to `Lax`
  - [ ] Try accessing cookie with `document.cookie` in console
  - [ ] Verify cookie not accessible (undefined or empty)

- [ ] **Verify Session Revocation**
  - [ ] Login successfully
  - [ ] Note session ID from database
  - [ ] Manually revoke session: `UPDATE sessions SET is_active = 0 WHERE id = '<session-id>'`
  - [ ] Try accessing protected page
  - [ ] Verify redirected to login (session invalid)

### 5.10 Linting & Type Checking

- [ ] **Run Linter**
  - [ ] Run: `npm run lint`
  - [ ] Fix any linting errors
  - [ ] Re-run until clean

- [ ] **Run Type Check**
  - [ ] Run: `npm run build` (or `tsc --noEmit`)
  - [ ] Fix any TypeScript errors
  - [ ] Re-run until clean

**Phase 5 Completion Criteria:**
✅ All test cases pass  
✅ No errors in console  
✅ Security verified  
✅ Linting clean  
✅ TypeScript clean  
✅ Ready for deployment

---

## Phase 6: Deployment

### 6.1 Pre-Deployment Checklist

- [ ] **Code Quality**
  - [ ] All TypeScript errors fixed
  - [ ] All linting errors fixed
  - [ ] No console.error or console.log in production code (except error handlers)
  - [ ] All TODO comments resolved or documented

- [ ] **Environment Variables**
  - [ ] JWT_SECRET is strong and secure (32+ characters)
  - [ ] JWT_SECRET is different from development (security)
  - [ ] .dev.vars file NOT committed to git
  - [ ] .gitignore includes .dev.vars

- [ ] **Database Ready**
  - [ ] Local migrations tested and working
  - [ ] Database schema verified
  - [ ] Migration files ready to apply to production

### 6.2 Cloudflare Secrets Setup

- [ ] **Set Production Secrets**
  - [ ] Generate NEW JWT_SECRET for production: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  - [ ] Run: `npx wrangler secret put JWT_SECRET`
  - [ ] Paste production secret (different from dev)
  - [ ] Verify secret set successfully

### 6.3 Production Database Setup

- [ ] **Apply Migrations to Production**
  - [ ] Run: `npx wrangler d1 migrations apply quizmaker-database --remote`
  - [ ] Confirm migration applied
  - [ ] Verify no errors

- [ ] **Verify Production Database**
  - [ ] Run: `npx wrangler d1 execute quizmaker-database --remote --command "SELECT name FROM sqlite_master WHERE type='table'"`
  - [ ] Confirm both tables exist
  - [ ] Run: `npx wrangler d1 execute quizmaker-database --remote --command "SELECT name FROM sqlite_master WHERE type='index'"`
  - [ ] Confirm all indexes exist

### 6.4 Build & Deploy

- [ ] **Build Application**
  - [ ] Run: `npm run build`
  - [ ] Verify build completes successfully
  - [ ] Check for any build warnings
  - [ ] Verify build output in `.next/` directory

- [ ] **Deploy to Cloudflare**
  - [ ] Run: `npm run deploy`
  - [ ] Wait for deployment to complete
  - [ ] Note deployment URL
  - [ ] Verify deployment successful

### 6.5 Post-Deployment Verification

- [ ] **Access Production Site**
  - [ ] Open production URL in browser
  - [ ] Verify site loads without errors
  - [ ] Check browser console for errors
  - [ ] Verify no 404s in Network tab

- [ ] **Test Signup on Production**
  - [ ] Navigate to `/signup`
  - [ ] Create test account with valid data
  - [ ] Verify redirected to dashboard
  - [ ] Verify logged in successfully

- [ ] **Test Login on Production**
  - [ ] Logout
  - [ ] Navigate to `/login`
  - [ ] Login with test account
  - [ ] Verify successful login

- [ ] **Test Protected Routes on Production**
  - [ ] Logout
  - [ ] Try accessing `/dashboard`
  - [ ] Verify redirected to `/login`
  - [ ] Login and verify can access `/dashboard`

- [ ] **Test Logout on Production**
  - [ ] Click logout
  - [ ] Verify redirected to login
  - [ ] Verify can't access protected routes

### 6.6 Production Database Verification

- [ ] **Check Production Data**
  - [ ] Run: `npx wrangler d1 execute quizmaker-database --remote --command "SELECT COUNT(*) as count FROM users"`
  - [ ] Verify test user exists
  - [ ] Run: `npx wrangler d1 execute quizmaker-database --remote --command "SELECT COUNT(*) as count FROM sessions"`
  - [ ] Verify sessions being created

**Phase 6 Completion Criteria:**
✅ Production environment configured  
✅ Secrets set in Cloudflare  
✅ Database migrations applied  
✅ Application deployed successfully  
✅ Production testing complete  
✅ Feature live and functional

---

## Phase 7: Post-Deployment

### 7.1 Monitoring

- [ ] **Check Cloudflare Dashboard**
  - [ ] Navigate to Cloudflare Workers dashboard
  - [ ] Check deployment status
  - [ ] Monitor request counts
  - [ ] Check for any errors in logs

- [ ] **Monitor D1 Database**
  - [ ] Check D1 dashboard
  - [ ] Monitor query performance
  - [ ] Check storage usage
  - [ ] Verify no connection errors

### 7.2 Documentation

- [ ] **Update Project Documentation**
  - [ ] Mark authentication feature as complete
  - [ ] Document production URL
  - [ ] Document any deployment notes
  - [ ] Update README if needed

- [ ] **Document Known Issues**
  - [ ] Create list of any known bugs
  - [ ] Document workarounds
  - [ ] Create issues/tickets for fixes

### 7.3 Cleanup

- [ ] **Remove Test Data (Optional)**
  - [ ] Decide if test accounts should remain
  - [ ] Delete test users if needed
  - [ ] Clean up test sessions

- [ ] **Clean Local Environment**
  - [ ] Remove unnecessary console.logs
  - [ ] Remove commented code
  - [ ] Organize imports

### 7.4 Next Steps Planning

- [ ] **Plan Next Feature**
  - [ ] Authentication ✅ Complete
  - [ ] Next: MCQ CRUD operations
  - [ ] Review `docs/MCQ_CRUD.md`
  - [ ] Create SDLC checklist for MCQ feature

**Phase 7 Completion Criteria:**
✅ Monitoring in place  
✅ Documentation updated  
✅ Cleanup complete  
✅ Ready for next feature

---

## Summary Checklist

### Quick Status Overview

- [ ] **Phase 1: Planning & Setup** (0/3 sub-phases)
- [ ] **Phase 2: Database Layer** (0/4 sub-phases)
- [ ] **Phase 3: Backend/API Layer** (0/4 sub-phases)
- [ ] **Phase 4: Frontend/UI Layer** (0/7 sub-phases)
- [ ] **Phase 5: Integration & Testing** (0/10 sub-phases)
- [ ] **Phase 6: Deployment** (0/6 sub-phases)
- [ ] **Phase 7: Post-Deployment** (0/4 sub-phases)

### Estimated Task Count

- **Total Tasks:** ~200+ individual checklist items
- **Phases:** 7 major phases
- **Sub-phases:** 38 sub-phases
- **Critical Path:** Database → Backend → Frontend → Testing → Deployment

---

## How to Use This Checklist

1. **As Orchestrator**: Go through each phase sequentially
2. **Check off items** as they're completed
3. **Verify completion criteria** before moving to next phase
4. **Use sub-phase descriptions** to understand what's being built
5. **Refer to `BASIC_AUTHENTICATION.md`** for detailed code examples

---

**Last Updated:** December 17, 2025  
**Status:** Ready to Begin  
**Next Action:** Start Phase 1 - Planning & Setup

