import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Get D1 database from Cloudflare context or use local SQLite for development
 * The database is bound via Cloudflare Workers environment in production
 */
export function getDatabase(): D1Database {
  try {
    // Try to get Cloudflare context (works in both dev and production)
    const context = getCloudflareContext();
    if (context && context.env && context.env.quizmaker_database) {
      console.log('☁️ Using Cloudflare D1 database');
      return context.env.quizmaker_database;
    }
  } catch (error) {
    // getCloudflareContext() throws in certain scenarios, fallback to local
    console.log('⚠️ Cloudflare context not available:', error);
  }
  
  // Fallback to local SQLite for development
  if (process.env.NEXTJS_ENV === 'development') {
    console.log('💻 Using local SQLite database (development mode)');
    return getLocalD1Adapter();
  }
  
  // This should never happen in production if bindings are correctly configured
  throw new Error('D1 Database binding not available. Please check wrangler.jsonc configuration.');
}

/**
 * Get local D1 adapter (development only)
 * Uses dynamic imports to avoid bundling Node.js modules in production
 */
function getLocalD1Adapter(): D1Database {
  // This function only runs in local development
  // Dynamic require to prevent bundling in Cloudflare Workers
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { join } = require('path');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { existsSync, mkdirSync } = require('fs');
  
  // Create data directory if it doesn't exist
  const dataDir = join(process.cwd(), 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = join(dataDir, 'local.db');
  const db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  console.log('📂 Using local SQLite database:', dbPath);
  
  // Create D1-compatible adapter
  const adapter = {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      
      return {
        bind: (...params: unknown[]) => {
          return {
            all: async <T>() => {
              try {
                const results = stmt.all(...params) as T[];
                return { results, success: true };
              } catch (error) {
                console.error('Query error:', error);
                throw error;
              }
            },
            first: async <T>() => {
              try {
                const result = stmt.get(...params) as T | undefined;
                return result || null;
              } catch (error) {
                console.error('Query error:', error);
                throw error;
              }
            },
            run: async () => {
              try {
                const info = stmt.run(...params);
                return { success: true, meta: { changes: info.changes, last_row_id: info.lastInsertRowid } };
              } catch (error) {
                console.error('Mutation error:', error);
                throw error;
              }
            },
          };
        },
        all: async <T>() => {
          try {
            const results = stmt.all() as T[];
            return { results, success: true };
          } catch (error) {
            console.error('Query error:', error);
            throw error;
          }
        },
        first: async <T>() => {
          try {
            const result = stmt.get() as T | undefined;
            return result || null;
          } catch (error) {
            console.error('Query error:', error);
            throw error;
          }
        },
        run: async () => {
          try {
            const info = stmt.run();
            return { success: true, meta: { changes: info.changes, last_row_id: info.lastInsertRowid } };
          } catch (error) {
            console.error('Mutation error:', error);
            throw error;
          }
        },
      };
    }
  };
  
  return adapter as unknown as D1Database;
}

/**
 * Execute a query and return all results
 * @param db - D1 database instance
 * @param sql - SQL query string
 * @param params - Query parameters
 * @returns Array of results
 */
export async function executeQuery<T>(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const stmt = db.prepare(sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  const { results } = await bound.all<T>();
  return results || [];
}

/**
 * Execute a query and return first result
 * @param db - D1 database instance
 * @param sql - SQL query string
 * @param params - Query parameters
 * @returns First result or null
 */
export async function executeQueryFirst<T>(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const results = await executeQuery<T>(db, sql, params);
  return results[0] || null;
}

/**
 * Execute a mutation (INSERT, UPDATE, DELETE)
 * @param db - D1 database instance
 * @param sql - SQL mutation string
 * @param params - Query parameters
 */
export async function executeMutation(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): Promise<void> {
  const stmt = db.prepare(sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  await bound.run();
}
