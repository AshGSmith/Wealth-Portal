import 'server-only';

import { mkdirSync } from 'node:fs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Database from 'better-sqlite3';
import nodemailer from 'nodemailer';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import type { AccessibleUser, AuthSession, AuthUser, AuthView, ManagedUser } from '@/lib/auth/types';

const DATA_DIR = join(process.cwd(), '.data');
const DB_PATH = join(DATA_DIR, 'wealth-portal.sqlite');
export const SESSION_COOKIE_NAME = 'wm_session_v2';
const LEGACY_SESSION_COOKIE_NAMES = ['wm_session'];
const SESSION_REMEMBER_ME_SECONDS = 60 * 60 * 24 * 30;
const SESSION_STANDARD_SECONDS = 60 * 60 * 12;
const RESET_TOKEN_SECONDS = 60 * 60;

type UserRow = {
  id: string;
  name: string;
  email: string;
  date_of_birth: string | null;
  is_admin: number;
  is_active: number;
  password_hash: string;
  created_at: string;
  updated_at: string;
};

type SessionRow = {
  session_id: string;
  user_id: string;
  original_user_id: string | null;
  session_expires_at: string;
  session_remember_me: number;
  user_name: string;
  user_email: string;
  user_date_of_birth: string | null;
  user_is_admin: number;
  user_is_active: number;
  original_name: string | null;
  original_email: string | null;
  original_date_of_birth: string | null;
  original_is_admin: number | null;
  original_is_active: number | null;
};

let dbInstance: Database.Database | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function addSeconds(date: Date, seconds: number): string {
  return new Date(date.getTime() + seconds * 1000).toISOString();
}

function addDays(date: Date, days: number): string {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function toAuthUser(row: {
  id: string;
  name: string;
  email: string;
  date_of_birth: string | null;
  is_admin: number;
  is_active: number;
}): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    dateOfBirth: row.date_of_birth,
    isAdmin: Boolean(row.is_admin),
    isActive: Boolean(row.is_active),
  };
}

function toManagedUser(row: UserRow): ManagedUser {
  return {
    ...toAuthUser(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    linkedUserIds: getLinkedUserIds(row.id),
  };
}

function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      date_of_birth TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      remember_me INTEGER NOT NULL DEFAULT 0,
      original_user_id TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(original_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_links (
      user_id_a TEXT NOT NULL,
      user_id_b TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id_a, user_id_b),
      FOREIGN KEY(user_id_a) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id_b) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash ON password_reset_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_user_links_a ON user_links(user_id_a);
    CREATE INDEX IF NOT EXISTS idx_user_links_b ON user_links(user_id_b);
  `);

  const countRow = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (countRow.count === 0) {
    const createdAt = nowIso();
    const email = normalizeEmail(process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL || 'admin@wealthportal.local');
    const password = process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD || 'ChangeMe123!';
    db.prepare(`
      INSERT INTO users (
        id, name, email, date_of_birth, is_admin, is_active, password_hash, created_at, updated_at
      ) VALUES (
        @id, @name, @email, @date_of_birth, @is_admin, @is_active, @password_hash, @created_at, @updated_at
      )
    `).run({
      id: randomUUID(),
      name: process.env.AUTH_BOOTSTRAP_ADMIN_NAME || 'Admin User',
      email,
      date_of_birth: null,
      is_admin: 1,
      is_active: 1,
      password_hash: hashPassword(password),
      created_at: createdAt,
      updated_at: createdAt,
    });
    if (!process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD) {
      console.warn(
        `Seeded default admin user ${email} with password ${password}. ` +
        'Set AUTH_BOOTSTRAP_ADMIN_* env vars to override this for production.'
      );
    }
  }

  dbInstance = db;
  return db;
}

function getUserRowByEmail(email: string): UserRow | null {
  return getDb().prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email)) as UserRow | null;
}

function getUserRowById(id: string): UserRow | null {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | null;
}

function orderedLinkPair(userId: string, linkedUserId: string): [string, string] {
  return userId < linkedUserId ? [userId, linkedUserId] : [linkedUserId, userId];
}

function getLinkedUserIds(userId: string): string[] {
  const rows = getDb().prepare(`
    SELECT
      CASE
        WHEN user_id_a = @userId THEN user_id_b
        ELSE user_id_a
      END as linked_user_id
    FROM user_links
    WHERE user_id_a = @userId OR user_id_b = @userId
    ORDER BY linked_user_id
  `).all({ userId }) as Array<{ linked_user_id: string }>;

  return rows.map(row => row.linked_user_id);
}

function getAccessibleUsers(userId: string): AccessibleUser[] {
  const ids = [userId, ...getLinkedUserIds(userId)];
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return [];

  const placeholders = uniqueIds.map(() => '?').join(', ');
  const rows = getDb().prepare(`
    SELECT id, name, email
    FROM users
    WHERE is_active = 1
      AND id IN (${placeholders})
    ORDER BY name ASC, email ASC
  `).all(...uniqueIds) as AccessibleUser[];

  return rows;
}

function deleteSessionByHash(tokenHash: string): void {
  getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}

function shouldUseSecureCookies(): boolean {
  if (process.env.NODE_ENV !== 'production') return false;

  const appUrl = process.env.APP_URL?.trim();
  if (!appUrl) return true;

  try {
    const url = new URL(appUrl);
    const hostname = url.hostname.toLowerCase();
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    return url.protocol === 'https:' && !isLocalHost;
  } catch {
    return true;
  }
}

function buildSessionCookieOptions(rememberMe: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: shouldUseSecureCookies(),
    path: '/',
    ...(rememberMe ? { maxAge: SESSION_REMEMBER_ME_SECONDS } : {}),
  };
}

function createSessionRecord(userId: string, rememberMe: boolean, originalUserId: string | null = null): string {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = sha256(token);
  const now = new Date();

  getDb().prepare(`
    INSERT INTO sessions (id, user_id, token_hash, remember_me, original_user_id, expires_at, created_at)
    VALUES (@id, @user_id, @token_hash, @remember_me, @original_user_id, @expires_at, @created_at)
  `).run({
    id: randomUUID(),
    user_id: userId,
    token_hash: tokenHash,
    remember_me: rememberMe ? 1 : 0,
    original_user_id: originalUserId,
    expires_at: rememberMe ? addDays(now, 30) : addSeconds(now, SESSION_STANDARD_SECONDS),
    created_at: now.toISOString(),
  });

  return token;
}

async function setSessionCookie(token: string, rememberMe: boolean): Promise<void> {
  const cookieStore = await cookies();
  for (const legacyCookieName of LEGACY_SESSION_COOKIE_NAMES) {
    cookieStore.delete(legacyCookieName);
  }
  cookieStore.set(SESSION_COOKIE_NAME, token, buildSessionCookieOptions(rememberMe));
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  for (const legacyCookieName of LEGACY_SESSION_COOKIE_NAMES) {
    cookieStore.delete(legacyCookieName);
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export function getSessionForToken(token: string): AuthSession | null {
  const tokenHash = sha256(token);
  const row = getDb().prepare(`
    SELECT
      s.id as session_id,
      s.user_id,
      s.original_user_id,
      s.expires_at as session_expires_at,
      s.remember_me as session_remember_me,
      u.name as user_name,
      u.email as user_email,
      u.date_of_birth as user_date_of_birth,
      u.is_admin as user_is_admin,
      u.is_active as user_is_active,
      ou.name as original_name,
      ou.email as original_email,
      ou.date_of_birth as original_date_of_birth,
      ou.is_admin as original_is_admin,
      ou.is_active as original_is_active
    FROM sessions s
    INNER JOIN users u ON u.id = s.user_id
    LEFT JOIN users ou ON ou.id = s.original_user_id
    WHERE s.token_hash = ?
  `).get(tokenHash) as SessionRow | null;

  if (!row) return null;

  if (new Date(row.session_expires_at).getTime() <= Date.now()) {
    deleteSessionByHash(tokenHash);
    return null;
  }

  const user = toAuthUser({
    id: row.user_id,
    name: row.user_name,
    email: row.user_email,
    date_of_birth: row.user_date_of_birth,
    is_admin: row.user_is_admin,
    is_active: row.user_is_active,
  });

  if (!user.isActive) {
    deleteSessionsForUser(user.id);
    return null;
  }

  const originalUser = row.original_user_id
    ? toAuthUser({
        id: row.original_user_id,
        name: row.original_name ?? '',
        email: row.original_email ?? '',
        date_of_birth: row.original_date_of_birth,
        is_admin: row.original_is_admin ?? 0,
        is_active: row.original_is_active ?? 0,
      })
    : null;

  return {
    sessionId: row.session_id,
    user,
    originalUser,
    isImpersonating: Boolean(row.original_user_id),
  };
}

export const auth = cache(async (): Promise<AuthSession | null> => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = getSessionForToken(token);
  if (!session) {
    await clearSessionCookie();
  }
  return session;
});

export async function getAuthView(): Promise<AuthView | null> {
  const session = await auth();
  if (!session) return null;
  return {
    user: session.user,
    originalUser: session.originalUser,
    isImpersonating: session.isImpersonating,
    accessibleUsers: getAccessibleUsers(session.user.id),
  };
}

export async function requireUser(): Promise<AuthSession> {
  const session = await auth();
  if (!session) redirect('/login');
  return session;
}

export async function requireAdminUser(): Promise<AuthSession> {
  const session = await requireUser();
  const actingUser = session.originalUser ?? session.user;
  if (!actingUser.isAdmin) redirect('/dashboard');
  return session;
}

export async function signIn(email: string, password: string, rememberMe: boolean): Promise<AuthSession | null> {
  const user = getUserRowByEmail(email);
  if (!user || !user.is_active) return null;
  if (!verifyPassword(password, user.password_hash)) return null;

  const token = createSessionRecord(user.id, rememberMe);
  await setSessionCookie(token, rememberMe);
  return {
    sessionId: '',
    user: toAuthUser(user),
    originalUser: null,
    isImpersonating: false,
  };
}

export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) deleteSessionByHash(sha256(token));
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export function listUsers(): ManagedUser[] {
  const rows = getDb().prepare('SELECT * FROM users ORDER BY is_admin DESC, name ASC, email ASC').all() as UserRow[];
  return rows.map(toManagedUser);
}

export function createUser(input: {
  name: string;
  email: string;
  dateOfBirth?: string | null;
  isAdmin: boolean;
  isActive: boolean;
}): ManagedUser {
  const now = nowIso();
  const row = {
    id: randomUUID(),
    name: input.name.trim(),
    email: normalizeEmail(input.email),
    date_of_birth: input.dateOfBirth || null,
    is_admin: input.isAdmin ? 1 : 0,
    is_active: input.isActive ? 1 : 0,
    password_hash: hashPassword(randomBytes(24).toString('base64url')),
    created_at: now,
    updated_at: now,
  };

  getDb().prepare(`
    INSERT INTO users (id, name, email, date_of_birth, is_admin, is_active, password_hash, created_at, updated_at)
    VALUES (@id, @name, @email, @date_of_birth, @is_admin, @is_active, @password_hash, @created_at, @updated_at)
  `).run(row);

  return toManagedUser(row);
}

export function updateUser(input: {
  id: string;
  name: string;
  email: string;
  dateOfBirth?: string | null;
  isAdmin: boolean;
  isActive: boolean;
  linkedUserIds?: string[];
}): ManagedUser {
  const now = nowIso();
  const db = getDb();
  db.prepare(`
    UPDATE users
    SET name = @name,
        email = @email,
        date_of_birth = @date_of_birth,
        is_admin = @is_admin,
        is_active = @is_active,
        updated_at = @updated_at
    WHERE id = @id
  `).run({
    id: input.id,
    name: input.name.trim(),
    email: normalizeEmail(input.email),
    date_of_birth: input.dateOfBirth || null,
    is_admin: input.isAdmin ? 1 : 0,
    is_active: input.isActive ? 1 : 0,
    updated_at: now,
  });

  if (input.linkedUserIds) {
    const nextIds = [...new Set(input.linkedUserIds.filter(linkedUserId => linkedUserId !== input.id))];
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM user_links WHERE user_id_a = ? OR user_id_b = ?').run(input.id, input.id);
      const insert = db.prepare(`
        INSERT INTO user_links (user_id_a, user_id_b, created_at)
        VALUES (?, ?, ?)
      `);
      for (const linkedUserId of nextIds) {
        const [userIdA, userIdB] = orderedLinkPair(input.id, linkedUserId);
        insert.run(userIdA, userIdB, now);
      }
    });
    transaction();
  }

  const updated = getUserRowById(input.id);
  if (!updated) throw new Error('User not found after update');

  if (!input.isActive) {
    deleteSessionsForUser(input.id);
  }

  return toManagedUser(updated);
}

export function setUserPassword(userId: string, password: string): void {
  getDb().prepare(`
    UPDATE users
    SET password_hash = @password_hash,
        updated_at = @updated_at
    WHERE id = @id
  `).run({
    id: userId,
    password_hash: hashPassword(password),
    updated_at: nowIso(),
  });

  getDb().prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(userId);
  deleteSessionsForUser(userId);
}

export function deleteUser(userId: string): void {
  const db = getDb();
  const existingUser = getUserRowById(userId);
  if (!existingUser) {
    throw new Error('User not found.');
  }

  const remainingAdminCount = db.prepare(`
    SELECT COUNT(*) as count
    FROM users
    WHERE is_admin = 1 AND id != ?
  `).get(userId) as { count: number };

  if (existingUser.is_admin && remainingAdminCount.count === 0) {
    throw new Error('You must keep at least one admin user.');
  }

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM user_links WHERE user_id_a = ? OR user_id_b = ?').run(userId, userId);
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM sessions WHERE user_id = ? OR original_user_id = ?').run(userId, userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });

  transaction();
}

export function deleteSessionsForUser(userId: string): void {
  getDb().prepare('DELETE FROM sessions WHERE user_id = ? OR original_user_id = ?').run(userId, userId);
}

export async function startImpersonation(targetUserId: string): Promise<void> {
  const session = await requireAdminUser();
  const actingUser = session.originalUser ?? session.user;
  const targetUser = getUserRowById(targetUserId);

  if (!targetUser || !targetUser.is_active) {
    throw new Error('Target user is not available for impersonation.');
  }

  if (actingUser.id === targetUser.id) {
    throw new Error('You are already signed in as that user.');
  }

  await signOut();
  const token = createSessionRecord(targetUser.id, true, actingUser.id);
  await setSessionCookie(token, true);
}

export async function stopImpersonation(): Promise<void> {
  const session = await requireUser();
  if (!session.originalUser) return;

  await signOut();
  const token = createSessionRecord(session.originalUser.id, true, null);
  await setSessionCookie(token, true);
}

export function getResetTokenUser(token: string): AuthUser | null {
  const row = getDb().prepare(`
    SELECT u.*
    FROM password_reset_tokens prt
    INNER JOIN users u ON u.id = prt.user_id
    WHERE prt.token_hash = ?
      AND prt.used_at IS NULL
      AND prt.expires_at > ?
  `).get(sha256(token), nowIso()) as UserRow | null;

  return row ? toAuthUser(row) : null;
}

export function consumeResetToken(token: string, password: string): AuthUser | null {
  const db = getDb();
  const tokenHash = sha256(token);
  const row = db.prepare(`
    SELECT prt.id, prt.user_id, u.*
    FROM password_reset_tokens prt
    INNER JOIN users u ON u.id = prt.user_id
    WHERE prt.token_hash = ?
      AND prt.used_at IS NULL
      AND prt.expires_at > ?
  `).get(tokenHash, nowIso()) as (UserRow & { user_id: string; id: string }) | null;

  if (!row) return null;

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE users
      SET password_hash = ?, updated_at = ?
      WHERE id = ?
    `).run(hashPassword(password), nowIso(), row.user_id);

    db.prepare(`
      UPDATE password_reset_tokens
      SET used_at = ?
      WHERE id = ?
    `).run(nowIso(), row.id);

    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
  });

  transaction();
  return toAuthUser(row);
}

export async function createPasswordReset(email: string): Promise<{ resetUrl: string | null }> {
  const user = getUserRowByEmail(email);
  if (!user || !user.is_active) return { resetUrl: null };

  const token = randomBytes(32).toString('base64url');
  const tokenHash = sha256(token);
  const createdAt = nowIso();

  getDb().prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);
  getDb().prepare(`
    INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
    VALUES (?, ?, ?, ?, NULL, ?)
  `).run(
    randomUUID(),
    user.id,
    tokenHash,
    addSeconds(new Date(), RESET_TOKEN_SECONDS),
    createdAt,
  );

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const resetUrl = `${appUrl.replace(/\/$/, '')}/reset-password/${token}`;
  await sendPasswordResetEmail(user.email, user.name, resetUrl, 'reset');
  return { resetUrl };
}

export async function sendUserInvitation(email: string): Promise<{ resetUrl: string | null }> {
  const user = getUserRowByEmail(email);
  if (!user || !user.is_active) return { resetUrl: null };

  const token = randomBytes(32).toString('base64url');
  const tokenHash = sha256(token);
  const createdAt = nowIso();

  getDb().prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);
  getDb().prepare(`
    INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
    VALUES (?, ?, ?, ?, NULL, ?)
  `).run(
    randomUUID(),
    user.id,
    tokenHash,
    addSeconds(new Date(), RESET_TOKEN_SECONDS),
    createdAt,
  );

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const resetUrl = `${appUrl.replace(/\/$/, '')}/reset-password/${token}`;
  await sendPasswordResetEmail(user.email, user.name, resetUrl, 'invite');
  return { resetUrl };
}

async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetUrl: string,
  mode: 'reset' | 'invite',
): Promise<void> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || 'noreply@wealthportal.local';
  const isInvite = mode === 'invite';
  const subject = isInvite ? 'Your WealthPortal account is ready' : 'Reset your WealthPortal password';
  const heading = isInvite ? 'Welcome to WealthPortal' : 'Reset your WealthPortal password';
  const intro = isInvite
    ? 'An account has been created for you. Use the button below to set your password and access the portal.'
    : 'Use the button below to reset your password.';
  const actionLabel = isInvite ? 'Set password' : 'Reset password';
  const fallbackLog = isInvite ? 'Invitation created' : 'Password reset requested';

  if (!host || !port || !user || !pass) {
    console.info(`${fallbackLog} for ${email}. Reset link: ${resetUrl}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to: email,
    subject,
    text: `Hi ${name},\n\n${intro}\n${resetUrl}\n\nThis link expires in 1 hour.`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
        <h2 style="margin-bottom: 12px;">${heading}</h2>
        <p>Hi ${name},</p>
        <p>${intro} This link expires in 1 hour.</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 18px; border-radius: 10px;">
            ${actionLabel}
          </a>
        </p>
        <p>If the button does not work, use this link:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
      </div>
    `,
  });
}

export function isBirthdayMonth(dateOfBirth: string | null): boolean {
  if (!dateOfBirth) return false;
  const birthMonth = dateOfBirth.slice(5, 7);
  const currentMonth = new Date().toISOString().slice(5, 7);
  return birthMonth === currentMonth;
}
