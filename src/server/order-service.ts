/**
 * Order service (ADR-027). Money is frozen at creation: Lab orders price
 * through the verified mix engine, premade orders through the variant's
 * all-inclusive shelf price. Every lifecycle move appends to the per-order
 * timeline (order_events) AND the global compliance audit log (ADR-015).
 *
 * No API routes yet on purpose: unauthenticated order/admin endpoints would
 * violate ADR-014 worse than no endpoints. Routes land with the auth slice;
 * until then every entry point takes an explicit actorId.
 */
import { randomUUID } from 'node:crypto';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import {
  auditLog,
  ingredients,
  inventoryMovements,
  orderEvents,
  orders,
  productRecipeLines,
  products,
  productVariants,
  stores,
  users,
} from '../db/schema';
import { allocateIngredientGrams, type IngredientUsage } from '../domain/inventory';
import {
  assertFulfillmentTransition,
  assertPaymentMethod,
  assertPaymentTransition,
  assertSnapshotConsistent,
  decideDelivery,
  FULFILLMENT_STATUSES,
  type FulfillmentStatus,
  gstSplitInclusive,
  OrderError,
  type OrderSnapshot,
  PAYMENT_STATUSES,
  type PaymentStatus,
} from '../domain/order-engine';
import type { MixCalculateRequest } from './contracts';
import { calculateMixFromDb } from './mix-service';

export interface ContactBlock {
  customerName: string;
  customerPhone: string;
  addressLine: string;
  city: string;
  pincode: string;
}

export interface CreateLabOrderInput {
  storeId: string;
  userId?: string;
  contact: ContactBlock;
  paymentMethod: string;
  wantFreeDelivery: boolean;
  mix: MixCalculateRequest;
}

export interface CreatePremadeOrderInput {
  storeId: string;
  productId: string;
  packSizeG: number;
  packageCount?: number;
  userId?: string;
  contact: ContactBlock;
  paymentMethod: string;
  wantFreeDelivery: boolean;
}

/** Premade snapshots keep the exact-% composition next to the single money line. */
export type PremadeSnapshot = OrderSnapshot & { composition: Array<{ name: string; bps: number }> };

export interface CreatedOrder {
  orderId: string;
  snapshot: OrderSnapshot;
  totalPaise: number;
  deliveryWaived: boolean;
}

export interface TransitionInput {
  orderId: string;
  to: string;
  actorId?: string;
  note?: string;
}

const newOrderId = () => `od_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;

async function creditsFor(db: LibSQLDatabase, userId: string | undefined): Promise<number> {
  if (!userId) return 0;
  const u = await db.select({ credits: users.freeDeliveryCredits }).from(users).where(eq(users.id, userId)).get();
  return u?.credits ?? 0;
}

async function insertOrderAndEvent(
  db: LibSQLDatabase,
  row: typeof orders.$inferInsert,
  event: { actorUserId: string | null; note: string | null },
  creditUserId: string | null,
  ingredientUsage: readonly IngredientUsage[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(orders).values(row);
    await tx.insert(orderEvents).values({
      orderId: row.id as string,
      actorUserId: event.actorUserId,
      action: 'CREATED',
      toStatus: 'PLACED',
      note: event.note,
    });
    if (ingredientUsage.length > 0) {
      await tx.insert(inventoryMovements).values(
        ingredientUsage.map((usage) => ({
          storeId: row.storeId as string,
          ingredientId: usage.ingredientId,
          deltaG: -usage.grams,
          reason: 'CONSUMED_BY_ORDER',
          orderId: row.id as string,
          note: 'Reserved for the placed order',
          actorUserId: event.actorUserId,
        })),
      );
    }
    if (creditUserId) {
      await tx
        .update(users)
        .set({ freeDeliveryCredits: sql`${users.freeDeliveryCredits} - 1` })
        .where(eq(users.id, creditUserId));
    }
  });
}

/* ------------------------------------------------------------------ */
/* Creation                                                            */
/* ------------------------------------------------------------------ */

export async function createLabOrder(db: LibSQLDatabase, input: CreateLabOrderInput): Promise<CreatedOrder> {
  assertPaymentMethod(input.paymentMethod);
  const calc = await calculateMixFromDb(db, input.mix); // every mix rule enforced here
  const p = calc.mix.pricing;
  const creditsAvailable = await creditsFor(db, input.userId);
  const delivery = decideDelivery({
    subtotalPaise: p.subtotalPaise,
    deliveryFeePaise: p.deliveryPaise, // quoted, per order
    wantFreeDelivery: input.wantFreeDelivery,
    creditsAvailable,
  });

  const snapshot: OrderSnapshot = {
    kind: 'LAB',
    packSizeG: input.mix.targetWeightG,
    packageCount: input.mix.packageCount,
    ingredientUsage: calc.mix.composition.map((line) => ({
      ingredientId: line.ingredientId,
      grams: line.weightG * input.mix.packageCount,
    })),
    lines: calc.mix.composition.map((c) => ({
      name: c.name,
      weightG: c.weightG,
      displayPercent: c.displayPercent,
      linePaise: c.linePaise,
    })),
    rawPaise: p.rawPaise,
    millingPaise: p.millingPaise,
    packagingPaise: p.packagingPaise,
    subtotalPaise: p.subtotalPaise,
    gstRateBps: p.gstRateBps,
    gstPaise: p.gstPaise,
    cgstPaise: p.cgstPaise,
    sgstPaise: p.sgstPaise,
    deliveryFeePaise: p.deliveryPaise,
    deliveryPaise: delivery.deliveryPaise,
    deliveryWaived: delivery.deliveryWaived,
    totalPaise: delivery.totalPaise,
    ratesProvisional: calc.provisionalPricing,
    nutritionSources: calc.mix.nutrition.sources,
  };
  assertSnapshotConsistent(snapshot);

  const orderId = newOrderId();
  await insertOrderAndEvent(
    db,
    {
      id: orderId,
      storeId: input.storeId,
      userId: input.userId ?? null,
      kind: 'LAB',
      productId: null,
      packSizeG: input.mix.targetWeightG,
      packageCount: input.mix.packageCount,
      ...input.contact,
      paymentMethod: input.paymentMethod,
      itemsSnapshot: JSON.stringify(snapshot),
      rawPaise: snapshot.rawPaise,
      millingPaise: snapshot.millingPaise,
      packagingPaise: snapshot.packagingPaise,
      subtotalPaise: snapshot.subtotalPaise,
      gstRateBps: snapshot.gstRateBps,
      gstPaise: snapshot.gstPaise,
      cgstPaise: snapshot.cgstPaise,
      sgstPaise: snapshot.sgstPaise,
      deliveryFeePaise: snapshot.deliveryFeePaise,
      deliveryPaise: snapshot.deliveryPaise,
      deliveryWaived: snapshot.deliveryWaived,
      totalPaise: snapshot.totalPaise,
      ratesProvisional: snapshot.ratesProvisional,
      nutritionSourcesJson: JSON.stringify(snapshot.nutritionSources ?? []),
    },
    {
      actorUserId: input.userId ?? null,
      note: delivery.deliveryWaived ? 'free-delivery credit redeemed' : null,
    },
    delivery.deliveryWaived && input.userId ? input.userId : null,
    snapshot.ingredientUsage ?? [],
  );
  return { orderId, snapshot, totalPaise: snapshot.totalPaise, deliveryWaived: snapshot.deliveryWaived };
}

export async function createPremadeOrder(db: LibSQLDatabase, input: CreatePremadeOrderInput): Promise<CreatedOrder> {
  assertPaymentMethod(input.paymentMethod);
  const packageCount = input.packageCount ?? 1;
  if (!Number.isInteger(packageCount) || packageCount < 1) {
    throw new OrderError('INVALID_QUANTITY', `packageCount must be a positive integer, got ${packageCount}`);
  }

  const product = await db
    .select()
    .from(products)
    .where(and(eq(products.id, input.productId), eq(products.storeId, input.storeId), eq(products.status, 'active')))
    .get();
  const variant = product
    ? await db
        .select()
        .from(productVariants)
        .where(
          and(
            eq(productVariants.productId, product.id),
            eq(productVariants.packSizeG, input.packSizeG),
            eq(productVariants.active, true),
          ),
        )
        .get()
    : undefined;
  if (!product || !variant) {
    throw new OrderError('VARIANT_NOT_FOUND', `No ${input.packSizeG} g variant for product ${input.productId}`, {
      productId: input.productId,
      packSizeG: input.packSizeG,
    });
  }
  const store = await db.select().from(stores).where(eq(stores.id, product.storeId)).get();
  if (!store) {
    throw new OrderError('VARIANT_NOT_FOUND', `Store configuration missing for ${product.storeId}`);
  }

  const recipe = await db
    .select({ ingredientId: ingredients.id, name: ingredients.name, bps: productRecipeLines.ratioBps })
    .from(productRecipeLines)
    .innerJoin(ingredients, eq(ingredients.id, productRecipeLines.ingredientId))
    .where(eq(productRecipeLines.productId, product.id))
    .all();

  const raw = variant.sellPaise * packageCount; // shelf price is all-inclusive (ADR-027 rule 1/6)
  const gst = gstSplitInclusive(raw, store.gstRateBps);
  const creditsAvailable = await creditsFor(db, input.userId);
  const delivery = decideDelivery({
    subtotalPaise: raw,
    deliveryFeePaise: store.deliveryFeePaise,
    wantFreeDelivery: input.wantFreeDelivery,
    creditsAvailable,
  });

  const snapshot: PremadeSnapshot = {
    kind: 'PREMADE',
    packSizeG: input.packSizeG,
    packageCount,
    ingredientUsage: allocateIngredientGrams(
      input.packSizeG * packageCount,
      recipe.map((line) => ({ ingredientId: line.ingredientId, ratioBps: line.bps })),
    ).map((line) => ({
      ingredientId: line.ingredientId,
      grams: line.grams,
    })),
    lines: [
      {
        name: `${product.name} · ${input.packSizeG / 1000} kg pouch${packageCount > 1 ? ` ×${packageCount}` : ''}`,
        weightG: input.packSizeG * packageCount,
        displayPercent: '100.00%',
        linePaise: raw,
      },
    ],
    rawPaise: raw,
    millingPaise: 0,
    packagingPaise: 0,
    subtotalPaise: raw,
    gstRateBps: store.gstRateBps,
    ...gst,
    deliveryFeePaise: store.deliveryFeePaise,
    deliveryPaise: delivery.deliveryPaise,
    deliveryWaived: delivery.deliveryWaived,
    totalPaise: delivery.totalPaise,
    ratesProvisional: variant.provisional,
    composition: recipe.map((r) => ({ name: r.name, bps: r.bps })).sort((a, b) => b.bps - a.bps),
  };
  assertSnapshotConsistent(snapshot);

  const orderId = newOrderId();
  await insertOrderAndEvent(
    db,
    {
      id: orderId,
      storeId: input.storeId,
      userId: input.userId ?? null,
      kind: 'PREMADE',
      productId: product.id,
      packSizeG: input.packSizeG,
      packageCount,
      ...input.contact,
      paymentMethod: input.paymentMethod,
      itemsSnapshot: JSON.stringify(snapshot),
      rawPaise: raw,
      millingPaise: 0,
      packagingPaise: 0,
      subtotalPaise: raw,
      gstRateBps: store.gstRateBps,
      gstPaise: gst.gstPaise,
      cgstPaise: gst.cgstPaise,
      sgstPaise: gst.sgstPaise,
      deliveryFeePaise: store.deliveryFeePaise,
      deliveryPaise: delivery.deliveryPaise,
      deliveryWaived: delivery.deliveryWaived,
      totalPaise: delivery.totalPaise,
      ratesProvisional: variant.provisional,
      nutritionSourcesJson: null,
    },
    {
      actorUserId: input.userId ?? null,
      note: delivery.deliveryWaived ? 'free-delivery credit redeemed' : null,
    },
    delivery.deliveryWaived && input.userId ? input.userId : null,
    snapshot.ingredientUsage ?? [],
  );
  return { orderId, snapshot, totalPaise: delivery.totalPaise, deliveryWaived: delivery.deliveryWaived };
}

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

async function loadOrder(db: LibSQLDatabase, orderId: string) {
  const order = await db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!order) throw new OrderError('ORDER_NOT_FOUND', `Unknown order ${orderId}`, { orderId });
  return order;
}

function asFulfillment(s: string): FulfillmentStatus {
  if (!(FULFILLMENT_STATUSES as readonly string[]).includes(s)) {
    throw new OrderError('ILLEGAL_FULFILLMENT_TRANSITION', `Unknown fulfilment status "${s}"`, { to: s });
  }
  return s as FulfillmentStatus;
}

function asPayment(s: string): PaymentStatus {
  if (!(PAYMENT_STATUSES as readonly string[]).includes(s)) {
    throw new OrderError('ILLEGAL_PAYMENT_TRANSITION', `Unknown payment status "${s}"`, { to: s });
  }
  return s as PaymentStatus;
}

export async function transitionFulfillment(db: LibSQLDatabase, input: TransitionInput) {
  const order = await loadOrder(db, input.orderId);
  const from = asFulfillment(order.fulfillmentStatus);
  const to = asFulfillment(input.to);
  assertFulfillmentTransition(from, to, { paymentStatus: asPayment(order.paymentStatus) });

  await db.transaction(async (tx) => {
    await tx.update(orders).set({ fulfillmentStatus: to, updatedAt: Date.now() }).where(eq(orders.id, order.id));
    await tx.insert(orderEvents).values({
      orderId: order.id,
      actorUserId: input.actorId ?? null,
      action: 'FULFILLMENT',
      fromStatus: from,
      toStatus: to,
      note: input.note ?? null,
    });
    await tx.insert(auditLog).values({
      actorUserId: input.actorId ?? null,
      action: 'ORDER_FULFILLMENT_TRANSITION',
      entityType: 'order',
      entityId: order.id,
      beforeJson: JSON.stringify({ fulfillmentStatus: from }),
      afterJson: JSON.stringify({ fulfillmentStatus: to }),
    });
    // ADR-017 hook: when `to === 'DELIVERED'`, referral awarding lands here
    // (referee's first delivery → referrer +1 credit, cap per store config).
    // Deliberately NOT implemented until the signup/referral slice exists.
  });
  return { ...order, fulfillmentStatus: to };
}

export async function markPayment(db: LibSQLDatabase, input: TransitionInput) {
  const order = await loadOrder(db, input.orderId);
  const from = asPayment(order.paymentStatus);
  const to = asPayment(input.to);
  assertPaymentTransition(from, to);

  await db.transaction(async (tx) => {
    await tx.update(orders).set({ paymentStatus: to, updatedAt: Date.now() }).where(eq(orders.id, order.id));
    await tx.insert(orderEvents).values({
      orderId: order.id,
      actorUserId: input.actorId ?? null, // null actor = customer self-attestation ("I have paid")
      action: 'PAYMENT',
      fromStatus: from,
      toStatus: to,
      note: input.note ?? null,
    });
    await tx.insert(auditLog).values({
      actorUserId: input.actorId ?? null,
      action: 'ORDER_PAYMENT_TRANSITION',
      entityType: 'order',
      entityId: order.id,
      beforeJson: JSON.stringify({ paymentStatus: from }),
      afterJson: JSON.stringify({ paymentStatus: to }),
    });
  });
  return { ...order, paymentStatus: to };
}

export async function cancelOrder(db: LibSQLDatabase, input: Omit<TransitionInput, 'to'>) {
  const order = await loadOrder(db, input.orderId);
  const from = asFulfillment(order.fulfillmentStatus);
  assertFulfillmentTransition(from, 'CANCELLED', { paymentStatus: asPayment(order.paymentStatus) });

  const refundUserId = order.deliveryWaived ? order.userId : null;
  await db.transaction(async (tx) => {
    const updateResult = await tx
      .update(orders)
      .set({ fulfillmentStatus: 'CANCELLED', updatedAt: Date.now() })
      .where(and(eq(orders.id, order.id), eq(orders.fulfillmentStatus, from)))
      .run();
    if (updateResult.rowsAffected !== 1) {
      throw new OrderError('ILLEGAL_FULFILLMENT_TRANSITION', 'Order changed while cancellation was being applied.', {
        from,
        to: 'CANCELLED',
      });
    }
    await tx.insert(orderEvents).values({
      orderId: order.id,
      actorUserId: input.actorId ?? null,
      action: 'FULFILLMENT',
      fromStatus: from,
      toStatus: 'CANCELLED',
      note: input.note ?? null,
    });
    const reservedStock = await tx
      .select()
      .from(inventoryMovements)
      .where(and(eq(inventoryMovements.orderId, order.id), eq(inventoryMovements.reason, 'CONSUMED_BY_ORDER')))
      .all();
    if (reservedStock.length > 0) {
      await tx.insert(inventoryMovements).values(
        reservedStock.map((movement) => ({
          storeId: movement.storeId,
          ingredientId: movement.ingredientId,
          deltaG: -movement.deltaG,
          reason: 'RETURN_TO_STOCK',
          orderId: order.id,
          note: 'Order cancelled before preparation; stock reservation released',
          actorUserId: input.actorId ?? null,
        })),
      );
    }
    if (refundUserId) {
      // ADR-027 rule 5: cancellation refunds the redeemed credit.
      await tx
        .update(users)
        .set({ freeDeliveryCredits: sql`${users.freeDeliveryCredits} + 1` })
        .where(eq(users.id, refundUserId));
      await tx.insert(orderEvents).values({
        orderId: order.id,
        actorUserId: null,
        action: 'CREDIT_REFUND',
        note: 'free-delivery credit returned on cancellation',
      });
    }
    await tx.insert(auditLog).values({
      actorUserId: input.actorId ?? null,
      action: 'ORDER_CANCELLED',
      entityType: 'order',
      entityId: order.id,
      beforeJson: JSON.stringify({ fulfillmentStatus: from }),
      afterJson: JSON.stringify({ fulfillmentStatus: 'CANCELLED', creditRefunded: Boolean(refundUserId) }),
    });
  });
  return { ...order, fulfillmentStatus: 'CANCELLED' as const };
}

/** The exportable per-order timeline (ADR-015 "exportable as a list"). */
export async function listOrderEvents(db: LibSQLDatabase, orderId: string) {
  await loadOrder(db, orderId);
  return db.select().from(orderEvents).where(eq(orderEvents.orderId, orderId)).orderBy(asc(orderEvents.id)).all();
}

export async function getOrder(db: LibSQLDatabase, orderId: string) {
  return loadOrder(db, orderId);
}
