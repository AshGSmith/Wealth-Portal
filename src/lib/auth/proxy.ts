import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

export const SESSION_COOKIE_NAME = 'wm_session';

let dbInstance: Database.Database | null = null;

function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dataDir = join(process.cwd(), '.data');
  mkdirSync(dataDir, { recursive: true });
  dbInstance = new Database(join(dataDir, 'wealth-portal.sqlite'), { readonly: false });
  return dbInstance;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hasValidSessionToken(token: string): boolean {
  const row = getDb().prepare(`
    SELECT s.expires_at, u.is_active
    FROM sessions s
    INNER JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
  `).get(sha256(token)) as { expires_at: string; is_active: number } | null;

  if (!row) return false;
  if (!row.is_active) return false;
  return new Date(row.expires_at).getTime() > Date.now();
}
