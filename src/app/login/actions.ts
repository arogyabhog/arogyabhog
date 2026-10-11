'use server';

import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import {
  createSession,
  destroySession,
  getCurrentUser,
  SESSION_COOKIE,
  SESSION_DAYS,
  verifyPassword,
  writeAudit,
} from '@/server/auth';

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
  redirect('/admin');
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
