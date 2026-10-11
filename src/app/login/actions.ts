'use server';

import { randomBytes } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import {
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  SESSION_COOKIE,
  SESSION_DAYS,
  verifyPassword,
  writeAudit,
} from '@/server/auth';

/** Open-redirect guard: only same-origin absolute paths, never protocol-relative. */
function safeNext(formData: FormData): string | null {
  const n = String(formData.get('next') ?? '');
  if (!n.startsWith('/') || n.startsWith('//') || n.includes('\\')) return null;
  return n;
}

export async function login(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');
  const user = await db.select().from(users).where(eq(users.email, email)).get();
  if (!user || !verifyPassword(password, user.passwordHash)) {
    await writeAudit({
      actorUserId: user?.id ?? null,
      action: 'auth.login_failed',
      entityType: 'user',
      entityId: user?.id ?? email,
    });
    redirect('/login?error=1');
  }
  const token = await createSession(user.id);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  await writeAudit({ actorUserId: user.id, action: 'auth.login', entityType: 'user', entityId: user.id });
  redirect(safeNext(formData) ?? (user.role === 'CUSTOMER' ? '/' : '/admin'));
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const u = await getCurrentUser(); // read actor BEFORE destroying
  if (token) await destroySession(token);
  await writeAudit({
    actorUserId: u?.id ?? null,
    action: 'auth.logout',
    entityType: 'user',
    entityId: u?.id ?? 'unknown',
  });
  jar.delete(SESSION_COOKIE);
  redirect('/');
}

export async function register(formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');
  const referral =
    String(formData.get('referral') ?? '')
      .trim()
      .toUpperCase() || null;
  if (name.length < 2 || password.length < 8) redirect('/register?error=1');
  const existing = await db.select().from(users).where(eq(users.email, email)).get();
  if (existing) redirect('/register?error=2');
  let referredByCode: string | null = null;
  if (referral) {
    const referrer = await db.select().from(users).where(eq(users.referralCode, referral)).get();
    // ADR-017: unknown codes are ignored silently here; self-referral is
    // impossible because the actor does not exist yet.
    referredByCode = referrer?.referralCode ?? null;
  }
  const id = `us_${randomBytes(8).toString('hex')}`;
  const code = `C${randomBytes(3).toString('hex').toUpperCase()}`;
  await db.insert(users).values({
    id,
    role: 'CUSTOMER',
    storeId: null,
    email,
    passwordHash: hashPassword(password),
    displayName: name,
    referralCode: code,
    referredByCode,
    freeDeliveryCredits: referredByCode ? 2 : 1, // ADR-017: referred signup bonus
  });
  await writeAudit({
    actorUserId: id,
    action: 'auth.register',
    entityType: 'user',
    entityId: id,
    after: { referredByCode },
  });
  const token = await createSession(id);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  redirect('/');
}
