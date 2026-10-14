'use server';

import { randomUUID } from 'node:crypto';
import { and, count, eq, ne } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db as schemaDb } from '@/db/client';
import { auditLog, couponRedemptions, coupons, orders, stores } from '@/db/schema';
import { canManageOrder } from '@/server/admin-order-access';
import { getCurrentUser } from '@/server/auth';
import { parseCouponSettings } from '@/server/coupon-validation';

const db = schemaDb as unknown as LibSQLDatabase;

async function requireCouponStaff() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) redirect('/login');
  return user;
}

async function accessibleStore(storeId: string, staff: Awaited<ReturnType<typeof requireCouponStaff>>) {
  const store = await db.select().from(stores).where(eq(stores.id, storeId)).get();
  return store && canManageOrder({ role: staff.role, storeId: staff.storeId }, store.id) ? store : null;
}

function normalizedCoupon(formData: FormData, role: string) {
  return parseCouponSettings(
    {
      storeId: formData.get('storeId'),
      code: formData.get('code'),
      type: formData.get('type'),
      valueBps: formData.get('valueBps'),
      valueRupees: formData.get('valueRupees'),
      minOrderRupees: formData.get('minOrderRupees') ?? '',
      maxDiscountRupees: formData.get('maxDiscountRupees') ?? '',
      usageLimit: formData.get('usageLimit') ?? '',
      perUserLimit: formData.get('perUserLimit') ?? '',
      expiresOn: formData.get('expiresOn') ?? '',
    },
    role,
  );
}

export async function createCoupon(formData: FormData): Promise<void> {
  const staff = await requireCouponStaff();
  const parsed = normalizedCoupon(formData, staff.role);
  if (!parsed.success) redirect('/admin/coupons?notice=invalid');
  const store = await accessibleStore(parsed.data.storeId, staff);
  if (!store) redirect('/admin/coupons?notice=unavailable');
  const couponId = `cp_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
  const after = { ...parsed.data, active: true, createdBy: staff.id };
  try {
    await db.transaction(async (tx) => {
      await tx.insert(coupons).values({ id: couponId, ...after });
      await tx.insert(auditLog).values({
        actorUserId: staff.id,
        action: 'COUPON_CREATED',
        entityType: 'coupon',
        entityId: couponId,
        beforeJson: null,
        afterJson: JSON.stringify(after),
      });
    });
  } catch {
    redirect('/admin/coupons?notice=duplicate');
  }
  revalidatePath('/admin/coupons');
  redirect(`/admin/coupons?storeId=${encodeURIComponent(store.id)}&notice=created`);
}

export async function updateCoupon(formData: FormData): Promise<void> {
  const staff = await requireCouponStaff();
  const couponId = String(formData.get('couponId') ?? '');
  const parsed = normalizedCoupon(formData, staff.role);
  if (!parsed.success || couponId.length > 64 || couponId.length === 0) redirect('/admin/coupons?notice=invalid');
  const store = await accessibleStore(parsed.data.storeId, staff);
  if (!store) redirect('/admin/coupons?notice=unavailable');
  const existing = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.id, couponId), eq(coupons.storeId, store.id)))
    .get();
  if (!existing) redirect('/admin/coupons?notice=unavailable');
  const [uses] = await db
    .select({ n: count() })
    .from(couponRedemptions)
    .innerJoin(orders, eq(orders.id, couponRedemptions.orderId))
    .where(and(eq(couponRedemptions.couponId, couponId), ne(orders.fulfillmentStatus, 'CANCELLED')));
  if ((uses?.n ?? 0) > 0) redirect(`/admin/coupons?storeId=${encodeURIComponent(store.id)}&notice=locked`);

  const before = {
    code: existing.code,
    type: existing.type,
    value: existing.value,
    minOrderPaise: existing.minOrderPaise,
    maxDiscountPaise: existing.maxDiscountPaise,
    usageLimit: existing.usageLimit,
    perUserLimit: existing.perUserLimit,
    expiresAt: existing.expiresAt,
  };
  const after = parsed.data;
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(coupons)
        .set(after)
        .where(and(eq(coupons.id, couponId), eq(coupons.storeId, store.id)));
      await tx.insert(auditLog).values({
        actorUserId: staff.id,
        action: 'COUPON_UPDATED',
        entityType: 'coupon',
        entityId: couponId,
        beforeJson: JSON.stringify(before),
        afterJson: JSON.stringify(after),
      });
    });
  } catch {
    redirect(`/admin/coupons?storeId=${encodeURIComponent(store.id)}&notice=duplicate`);
  }
  revalidatePath('/admin/coupons');
  redirect(`/admin/coupons?storeId=${encodeURIComponent(store.id)}&notice=updated`);
}

export async function setCouponActive(formData: FormData): Promise<void> {
  const staff = await requireCouponStaff();
  const couponId = String(formData.get('couponId') ?? '');
  const activeText = String(formData.get('active') ?? '');
  const storeId = String(formData.get('storeId') ?? '');
  if (!couponId || couponId.length > 64 || !['true', 'false'].includes(activeText))
    redirect('/admin/coupons?notice=invalid');
  const store = await accessibleStore(storeId, staff);
  if (!store) redirect('/admin/coupons?notice=unavailable');
  const coupon = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.id, couponId), eq(coupons.storeId, store.id)))
    .get();
  if (!coupon) redirect('/admin/coupons?notice=unavailable');
  const active = activeText === 'true';
  await db.transaction(async (tx) => {
    await tx
      .update(coupons)
      .set({ active })
      .where(and(eq(coupons.id, couponId), eq(coupons.storeId, store.id)));
    await tx.insert(auditLog).values({
      actorUserId: staff.id,
      action: active ? 'COUPON_ACTIVATED' : 'COUPON_DEACTIVATED',
      entityType: 'coupon',
      entityId: couponId,
      beforeJson: JSON.stringify({ active: coupon.active }),
      afterJson: JSON.stringify({ active }),
    });
  });
  revalidatePath('/admin/coupons');
  redirect(`/admin/coupons?storeId=${encodeURIComponent(store.id)}&notice=${active ? 'activated' : 'deactivated'}`);
}
