'use server';

import { and, count, eq, ne } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db as schemaDb } from '@/db/client';
import { couponRedemptions, coupons, orders, products, productVariants, stores } from '@/db/schema';
import { SEED_STORE_ID } from '@/db/seed';
import { applyCoupon, CouponError, type CouponRule } from '@/domain/coupon';
import { getCurrentUser, writeAudit } from '@/server/auth';
import { createPremadeOrder } from '@/server/order-service';

const db = schemaDb as unknown as LibSQLDatabase;
const lineSchema = z
  .object({
    slug: z.string().min(1).max(120),
    packG: z.number().int().positive().max(10000),
    qty: z.number().int().min(1).max(20),
  })
  .strict();
const linesSchema = z.array(lineSchema).min(1).max(20);

/** One order per cart line; coupon validity and use capacity are checked for all siblings first. */
export async function placeOrders(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  let rawLines: unknown;
  try {
    rawLines = JSON.parse(String(formData.get('lines') ?? '[]'));
  } catch {
    redirect('/checkout?error=1');
  }
  const parsedLines = linesSchema.safeParse(rawLines);
  if (!parsedLines.success) redirect('/checkout?error=1');
  const lines = parsedLines.data;
  const contact = {
    customerName: String(formData.get('name') ?? '').trim(),
    customerPhone: String(formData.get('phone') ?? '').trim(),
    addressLine: String(formData.get('address') ?? '').trim(),
    city: String(formData.get('city') ?? '').trim(),
    pincode: String(formData.get('pincode') ?? '').trim(),
  };
  const paymentMethod = String(formData.get('payment') ?? 'COD');
  const couponCode = String(formData.get('couponCode') ?? '')
    .trim()
    .toUpperCase();
  if (
    contact.customerName.length < 2 ||
    contact.customerName.length > 120 ||
    !/^\+?[0-9 ()-]{10,20}$/.test(contact.customerPhone) ||
    contact.addressLine.length < 8 ||
    contact.addressLine.length > 300 ||
    contact.city.length < 2 ||
    contact.city.length > 80 ||
    !/^\d{6}$/.test(contact.pincode) ||
    !['COD', 'UPI_QR'].includes(paymentMethod) ||
    couponCode.length > 32
  )
    redirect('/checkout?error=1');

  // Resolve every line against the selected store before creating any sibling order.
  const resolved: Array<{ productId: string; packG: number; qty: number; subtotalPaise: number }> = [];
  for (const line of lines) {
    const product = await db
      .select()
      .from(products)
      .where(and(eq(products.slug, line.slug), eq(products.storeId, SEED_STORE_ID), eq(products.status, 'active')))
      .get();
    const variant = product
      ? await db
          .select()
          .from(productVariants)
          .where(
            and(
              eq(productVariants.productId, product.id),
              eq(productVariants.packSizeG, line.packG),
              eq(productVariants.active, true),
            ),
          )
          .get()
      : undefined;
    if (!product || !variant) redirect('/checkout?error=1');
    resolved.push({
      productId: product.id,
      packG: line.packG,
      qty: line.qty,
      subtotalPaise: variant.sellPaise * line.qty,
    });
  }

  if (couponCode) {
    const coupon = await db
      .select()
      .from(coupons)
      .where(and(eq(coupons.storeId, SEED_STORE_ID), eq(coupons.code, couponCode)))
      .get();
    if (!coupon) redirect('/checkout?couponError=NOT_FOUND');
    const store = await db.select().from(stores).where(eq(stores.id, SEED_STORE_ID)).get();
    if (!store) redirect('/checkout?error=1');
    for (const line of resolved) {
      const result = applyCoupon(coupon as CouponRule, {
        subtotalPaise: line.subtotalPaise,
        deliveryFeePaise: store.deliveryFeePaise,
      });
      if (!result.ok) redirect(`/checkout?couponError=${result.reason}`);
    }
    const [allUses] = await db
      .select({ n: count() })
      .from(couponRedemptions)
      .innerJoin(orders, eq(orders.id, couponRedemptions.orderId))
      .where(and(eq(couponRedemptions.couponId, coupon.id), ne(orders.fulfillmentStatus, 'CANCELLED')));
    const [userUses] = await db
      .select({ n: count() })
      .from(couponRedemptions)
      .innerJoin(orders, eq(orders.id, couponRedemptions.orderId))
      .where(
        and(
          eq(couponRedemptions.couponId, coupon.id),
          eq(couponRedemptions.userId, user.id),
          ne(orders.fulfillmentStatus, 'CANCELLED'),
        ),
      );
    if (coupon.usageLimit !== null && (allUses?.n ?? 0) + resolved.length > coupon.usageLimit)
      redirect('/checkout?couponError=USAGE_LIMIT');
    if (coupon.perUserLimit !== null && (userUses?.n ?? 0) + resolved.length > coupon.perUserLimit)
      redirect('/checkout?couponError=USER_LIMIT');
  }

  const ids: string[] = [];
  for (const line of resolved) {
    try {
      const created = await createPremadeOrder(db, {
        storeId: SEED_STORE_ID,
        productId: line.productId,
        packSizeG: line.packG,
        packageCount: line.qty,
        userId: user.id,
        contact,
        paymentMethod,
        wantFreeDelivery: false,
        ...(couponCode ? { couponCode } : {}),
      });
      ids.push(created.orderId);
    } catch (error) {
      if (error instanceof CouponError) redirect(`/checkout?couponError=${error.code}`);
      throw error;
    }
  }
  await writeAudit({
    actorUserId: user.id,
    action: 'order.placed',
    entityType: 'order',
    entityId: ids.join('+'),
    after: { paymentMethod, lines, couponCode: couponCode || null },
  });
  redirect(ids.length === 1 ? `/orders/${ids[0]}?placed=1` : '/orders?placed=1');
}
