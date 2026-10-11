'use server';

import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { redirect } from 'next/navigation';
import { db as schemaDb } from '@/db/client';

const db = schemaDb as unknown as LibSQLDatabase;

import { orders } from '@/db/schema';
import { getCurrentUser } from '@/server/auth';
import { markPayment } from '@/server/order-service';

/** Customer attests a UPI transfer; admin verification flips it to PAID. */
export async function attestPayment(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const orderId = String(formData.get('orderId') ?? '');
  const order = await db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!order || order.userId !== user.id) redirect('/orders');
  // markPayment writes the order event + audit row itself (actor = customer).
  await markPayment(db, {
    orderId,
    to: 'AWAITING_VERIFICATION',
    actorId: user.id,
    note: 'customer attested UPI transfer',
  });
  redirect(`/orders/${orderId}`);
}
