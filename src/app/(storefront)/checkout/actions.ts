'use server';

import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { redirect } from 'next/navigation';
import { db as schemaDb } from '@/db/client';

/** order-service is schema-agnostic (works on any dialect/db shape). */
const db = schemaDb as unknown as LibSQLDatabase;

import { products } from '@/db/schema';
import { SEED_STORE_ID } from '@/db/seed';
import { getCurrentUser, writeAudit } from '@/server/auth';
import { createPremadeOrder } from '@/server/order-service';

/** One order per cart line (the engine prices one product+pack per order;
 *  multi-product baskets become sibling orders placed atomically here). */
export async function placeOrders(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const lines = JSON.parse(String(formData.get('lines') ?? '[]')) as Array<{
    slug: string;
    packG: number;
    qty: number;
  }>;
  const contact = {
    customerName: String(formData.get('name') ?? ''),
    customerPhone: String(formData.get('phone') ?? ''),
    addressLine: String(formData.get('address') ?? ''),
    city: String(formData.get('city') ?? ''),
    pincode: String(formData.get('pincode') ?? ''),
  };
  const paymentMethod = String(formData.get('payment') ?? 'COD');
  if (lines.length === 0 || contact.customerPhone.length < 10 || contact.addressLine.length < 8) {
    redirect('/checkout?error=1');
  }
  const ids: string[] = [];
  for (const line of lines) {
    const product = await db.select().from(products).where(eq(products.slug, line.slug)).get();
    if (!product) continue;
    const created = await createPremadeOrder(db, {
      storeId: SEED_STORE_ID,
      productId: product.id,
      packSizeG: line.packG,
      packageCount: line.qty,
      userId: user.id,
      contact,
      paymentMethod,
      wantFreeDelivery: false,
    });
    ids.push(created.orderId);
  }
  if (ids.length === 0) redirect('/checkout?error=1');
  await writeAudit({
    actorUserId: user.id,
    action: 'order.placed',
    entityType: 'order',
    entityId: ids.join('+'),
    after: { paymentMethod, lines },
  });
  redirect(ids.length === 1 ? `/orders/${ids[0]}?placed=1` : '/orders?placed=1');
}
