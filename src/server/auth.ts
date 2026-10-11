/** Auth core (ADR-031): scrypt password hashes, opaque cookie sessions,
 *  server-side RBAC checks, mandatory audit writes (ADR-015).
 *  No JWTs, no providers, no client-side trust — every protected route
 *  re-reads the session server-side on each request. */
import { randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { db } from '@/db/client';
import { auditLog, sessions, users } from '@/db/schema';

export const SESSION_COOKIE = 'ab_session';
export const SESSION_DAYS = 30;

export { hashPassword, verifyPassword } from './passwords';

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await db.insert(sessions).values({
    token,
    userId,
    expiresAt: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export type SessionUser = typeof users.$inferSelect;

/** Current logged-in user, or null. Expired sessions are purged lazily. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, Date.now())))
    .get();
  return row?.user ?? null;
}

/** Mandatory audit write (ADR-015). Never throws the caller's flow. */
export async function writeAudit(entry: {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  await db.insert(auditLog).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    beforeJson: entry.before === undefined ? null : JSON.stringify(entry.before),
    afterJson: entry.after === undefined ? null : JSON.stringify(entry.after),
  });
}

export type Role = 'ADMIN' | 'MANAGER' | 'CUSTOMER';

/** Server-side gate for /admin routes (ADR-014). Returns the staff user. */
export async function requireStaff(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    throw new Error('STAFF_REQUIRED');
  }
  return user;
}
