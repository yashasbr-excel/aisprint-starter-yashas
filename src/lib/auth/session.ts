import { executeQuery, executeQueryFirst, executeMutation } from '@/lib/d1-client';

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
 * Hash a session token for storage using Web Crypto API (Edge Runtime compatible)
 * @param token - Session token to hash
 * @returns Hashed token
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Create a new session
 * @param db - D1 database instance
 * @param userId - User ID for the session
 * @param token - Session token to hash and store
 * @param metadata - Optional session metadata (IP, user agent)
 * @returns Session ID
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
  const tokenHash = await hashToken(token);
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
 * @param db - D1 database instance
 * @param sessionId - Session ID to retrieve
 * @returns Session object or null if not found
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
 * @param db - D1 database instance
 * @param sessionId - Session ID to validate
 * @returns True if session is valid, false otherwise
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
 * @param db - D1 database instance
 * @param sessionId - Session ID to revoke
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
 * @param db - D1 database instance
 * @param userId - User ID whose sessions to revoke
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
 * @param db - D1 database instance
 * @param userId - User ID
 * @returns Array of active sessions
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
 * @param db - D1 database instance
 * @returns Number of sessions cleaned up (always 0 for D1)
 */
export async function cleanupExpiredSessions(
  db: D1Database
): Promise<number> {
  await executeMutation(
    db,
    'UPDATE sessions SET is_active = 0 WHERE expires_at < CURRENT_TIMESTAMP AND is_active = 1'
  );

  // Note: D1 doesn't return affected rows count easily
  // For monitoring, you could query before/after
  return 0;
}

