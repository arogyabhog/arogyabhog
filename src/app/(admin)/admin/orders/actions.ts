'use server';

import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db as schemaDb } from '@/db/client';
import { orders } from '@/db/schema';
import { FULFILLMENT_STATUSES, PAYMENT_STATUSES } from '@/domain/order-engine';
import { canManageOrder } from '@/server/admin-order-access';
import { getCurrentUser } from '@/server/auth';
import { markPayment, transitionFulfillment } from '@/server/order-service';

const db = schemaDb as unknown as LibSQLDatabase;

const fulfillmentActionSchema = z.object({
  orderId: z.string().min(1).max(100),
  to: z.enum(FULFILLMENT_STATUSES),
  note: z.string().trim().max(300).optional(),
});

// AWAITING_VERIFICATION is a customer attestation, never a staff action.
const paymentActionSchema = z.object({
  orderId: z.string().min(1).max(100),
  to: z.enum(PAYMENT_STATUSES).refine((status) => status !== 'AWAITING_VERIFICATION'),
  note: z.string().trim().max(300).optional(),
});

async function canAccessOrder(orderId: string, storeId: string | null, role: string): Promise<boolean> {
  const order = await db.select({ storeId: orders.storeId }).from(orders).where(eq(orders.id, orderId)).get();
  return order ? canManageOrder({ role, storeId }, order.storeId) : false;
}

async function requireOrderStaff() {
  const staff = await getCurrentUser();
  if (!staff || (staff.role !== 'ADMIN' && staff.role !== 'MANAGER')) redirect('/login');
  return staff;
}

export async function updateFulfillment(formData: FormData): Promise<void> {
  const staff = await requireOrderStaff();
  const parsed = fulfillmentActionSchema.safeParse({
    orderId: formData.get('orderId'),
    to: formData.get('to'),
    note: formData.get('note') || undefined,
  });
  if (!parsed.success) redirect('/admin/orders?notice=unavailable');
  if (!(await canAccessOrder(parsed.data.orderId, staff.storeId, staff.role))) {
    redirect('/admin/orders?notice=unavailable');
  }

  try {
    await transitionFulfillment(db, {
      orderId: parsed.data.orderId,
      to: parsed.data.to,
      actorId: staff.id,
      note: parsed.data.note,
    });
  } catch {
    redirect('/admin/orders?notice=transition-failed');
  }
  redirect('/admin/orders?notice=updated');
}

export async function updatePayment(formData: FormData): Promise<void> {
  const staff = await requireOrderStaff();
  const parsed = paymentActionSchema.safeParse({
    orderId: formData.get('orderId'),
    to: formData.get('to'),
    note: formData.get('note') || undefined,
  });
  if (!parsed.success) redirect('/admin/orders?notice=unavailable');
  if (!(await canAccessOrder(parsed.data.orderId, staff.storeId, staff.role))) {
    redirect('/admin/orders?notice=unavailable');
  }

  try {
    await markPayment(db, {
      orderId: parsed.data.orderId,
      to: parsed.data.to,
      actorId: staff.id,
      note: parsed.data.note,
    });
  } catch {
    redirect('/admin/orders?notice=transition-failed');
  }
  redirect('/admin/orders?notice=updated');
}
