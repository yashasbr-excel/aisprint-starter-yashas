-- Migration: Create Authentication Tables
-- Description: Creates users and sessions tables for email/password authentication with session tracking
-- Created: 2025-12-17

-- ============================================================================
-- Users Table
-- ============================================================================
-- Stores user account information with authentication credentials
CREATE TABLE users (
  -- Primary Key
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  
  -- Authentication
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  
  -- User Information
  full_name TEXT NOT NULL,
  
  -- Status
  is_active INTEGER DEFAULT 1, -- 0 = inactive, 1 = active
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME
);

-- Index for faster email lookups (critical for login performance)
CREATE INDEX idx_users_email ON users(email);

-- Index for filtering active users
CREATE INDEX idx_users_active ON users(is_active);

-- ============================================================================
-- Sessions Table
-- ============================================================================
-- Tracks active user sessions for authentication and security
CREATE TABLE sessions (
  -- Primary Key
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  
  -- User Reference
  user_id TEXT NOT NULL,
  
  -- Session Token (hashed for security)
  token_hash TEXT NOT NULL UNIQUE,
  
  -- Session Metadata
  ip_address TEXT,
  user_agent TEXT,
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Status
  is_active INTEGER DEFAULT 1, -- 0 = revoked, 1 = active
  
  -- Foreign Key Constraint
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for faster token lookups (critical for session validation)
CREATE INDEX idx_sessions_token ON sessions(token_hash);

-- Index for cleanup of expired sessions
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Index for retrieving user's sessions
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- Composite index for active sessions per user (optimizes common queries)
CREATE INDEX idx_sessions_active ON sessions(user_id, is_active);
