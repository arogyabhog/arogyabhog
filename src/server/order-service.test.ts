/**
 * Order-service integration tests: migrations + seed + full lifecycle over
 * in-process libSQL. Golden money values match the mix-service goldens
 * (everyday @ seed sell rates) and the premade shelf economics (ADR-027).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  auditLog,
  couponRedemptions,
  coupons,
  inventoryMovements,
  products,
  productVariants,
  users,
} from '../db/schema';
import { SEED_STORE_ID, seedDatabase } from '../db/seed';
import { CouponError } from '../domain/coupon';
import { OrderError } from '../domain/order-engine';
import {
  cancelOrder,
  createLabOrder,
  createPremadeOrder,
  getOrder,
  listOrderEvents,
  markPayment,
  type PremadeSnapshot,
  transitionFulfillment,
} from './order-service';

let db: LibSQLDatabase;
let everydayItems: Array<{ ingredientId: string; weightG: number }>;

const CONTACT = {
  customerName: 'Asha Devi',
  customerPhone: '+919876543210',
  addressLine: '12/345 Swaroop Nagar',
  city: 'Kanpur',
  pincode: '208002',
};

beforeAll(async () => {
  const client = createClient({ url: ':memory:' });
  db = drizzle(client);
  await migrate(db, { migrationsFolder: 'migrations' });
  await seedDatabase(db);
  await db.insert(users).values([
    {
      id: 'us_cust_credit',
      role: 'CUSTOMER',
      storeId: null,
      email: 'credit@cust.local',
      passwordHash: 'x',
      referralCode: 'CUST0001',
      referredByCode: null,
      freeDeliveryCredits: 1,
    },
    {
      id: 'us_cust_zero',
      role: 'CUSTOMER',
      storeId: null,
      email: 'zero@cust.local',
      passwordHash: 'x',
      referralCode: 'CUST0002',
      referredByCode: null,
      freeDeliveryCredits: 0,
    },
    {
      id: 'us_cust_cancel',
      role: 'CUSTOMER',
      storeId: null,
      email: 'cancel@cust.local',
      passwordHash: 'x',
      referralCode: 'CUST0003',
      referredByCode: null,
      freeDeliveryCredits: 1,
    },
  ]);
  const recipes = JSON.parse(
    readFileSync(join(process.cwd(), 'discovery/seed-premade-recipes.json'), 'utf8'),
  ) as Record<string, { lines: Array<{ ingredient_id: string; ratio_bps: number }> }>;
  const everyday = recipes.everyday;
  if (!everyday) throw new Error('seed-premade-recipes.json: everyday missing');
  everydayItems = everyday.lines.map((l) => ({ ingredientId: l.ingredient_id, weightG: l.ratio_bps }));
}, 60_000);

const labInput = (over: Partial<Parameters<typeof createLabOrder>[1]> = {}) => ({
  storeId: SEED_STORE_ID,
  contact: CONTACT,
  paymentMethod: 'COD',
  wantFreeDelivery: false,
  mix: { storeId: SEED_STORE_ID, targetWeightG: 10000, packageCount: 1, items: everydayItems },
  ...over,
});

const premadeInput = (over: Partial<Parameters<typeof createPremadeOrder>[1]> = {}) => ({
  storeId: SEED_STORE_ID,
  productId: 'pr_everyday',
  packSizeG: 10000,
  contact: CONTACT,
  paymentMethod: 'COD',
  wantFreeDelivery: false,
  ...over,
});

const codeOf = async (p: Promise<unknown>): Promise<string | null> => {
  try {
    await p;
    return null;
  } catch (e) {
    return e instanceof OrderError ? e.code : 'NON_ORDER_ERROR';
  }
};

const creditsOf = async (userId: string) =>
  (await db.select({ c: users.freeDeliveryCredits }).from(users).where(eq(users.id, userId)).get())?.c;

const couponCodeOf = async (p: Promise<unknown>): Promise<string | null> => {
  try {
    await p;
    return null;
  } catch (error) {
    return error instanceof CouponError ? error.code : 'NON_COUPON_ERROR';
  }
};

describe('lab orders', () => {
  it('freezes the engine goldens plus delivery into the order + snapshot', async () => {
    const created = await createLabOrder(db, labInput());
    expect(created.totalPaise).toBe(98050); // 93050 subtotal + 5000 delivery
    expect(created.deliveryWaived).toBe(false);

    const row = await getOrder(db, created.orderId);
    expect(row.rawPaise).toBe(88550);
    expect(row.millingPaise).toBe(4000);
    expect(row.packagingPaise).toBe(500);
    expect(row.subtotalPaise).toBe(93050);
    expect(row.gstPaise).toBe(4431);
    expect(row.cgstPaise).toBe(2215);
    expect(row.sgstPaise).toBe(2216);
    expect(row.deliveryFeePaise).toBe(5000);
    expect(row.deliveryPaise).toBe(5000);
    expect(row.ratesProvisional).toBe(true);
    expect(row.fulfillmentStatus).toBe('PLACED');
    expect(row.paymentStatus).toBe('UNPAID');

    const snap = JSON.parse(row.itemsSnapshot) as PremadeSnapshot;
    expect(snap.lines.reduce((a, l) => a + l.linePaise, 0)).toBe(88550);
    expect(snap.nutritionSources).toContain('IFCT2017');
    expect(snap.ingredientUsage?.reduce((sum, line) => sum + line.grams, 0)).toBe(10000);
    const stockMovements = await db
      .select()
      .from(inventoryMovements)
      .where(eq(inventoryMovements.orderId, created.orderId))
      .all();
    expect(stockMovements).toHaveLength(snap.ingredientUsage?.length ?? 0);
    expect(stockMovements.every((movement) => movement.reason === 'CONSUMED_BY_ORDER' && movement.deltaG < 0)).toBe(
      true,
    );
    expect(stockMovements.reduce((sum, movement) => sum + movement.deltaG, 0)).toBe(-10000);
    const events = await listOrderEvents(db, created.orderId);
    expect(events[0]?.action).toBe('CREATED');
  });

  it('redeems exactly one free-delivery credit when asked, and decrements the wallet', async () => {
    const created = await createLabOrder(db, labInput({ userId: 'us_cust_credit', wantFreeDelivery: true }));
    expect(created.deliveryWaived).toBe(true);
    expect(created.totalPaise).toBe(93050); // delivery waived
    expect(await creditsOf('us_cust_credit')).toBe(0);
    const events = await listOrderEvents(db, created.orderId);
    expect(events[0]?.note).toBe('free-delivery credit redeemed');
  });

  it('refuses redemption without credit but still allows a normal paid-delivery order', async () => {
    expect(await codeOf(createLabOrder(db, labInput({ userId: 'us_cust_zero', wantFreeDelivery: true })))).toBe(
      'CREDIT_NOT_AVAILABLE',
    );
    const ok = await createLabOrder(db, labInput({ userId: 'us_cust_zero', wantFreeDelivery: false }));
    expect(ok.totalPaise).toBe(98050);
    expect(await creditsOf('us_cust_zero')).toBe(0);
  });

  it('rejects a gateway payment method — COD and UPI_QR only, forever (ADR-010)', async () => {
    expect(await codeOf(createLabOrder(db, labInput({ paymentMethod: 'RAZORPAY' })))).toBe('UNKNOWN_PAYMENT_METHOD');
  });
});

describe('fulfilment lifecycle', () => {
  it('walks the happy COD path and gates CLOSED behind PAID', async () => {
    const { orderId } = await createLabOrder(db, labInput());
    for (const to of ['PREPARING', 'PREPARED', 'SHIPPED', 'DELIVERED']) {
      await transitionFulfillment(db, { orderId, to, actorId: 'us_admin_seed' });
    }
    expect(await codeOf(transitionFulfillment(db, { orderId, to: 'CLOSED', actorId: 'us_admin_seed' }))).toBe(
      'CLOSE_REQUIRES_PAID',
    );
    await markPayment(db, { orderId, to: 'PAID', actorId: 'us_admin_seed', note: 'cash collected with driver' });
    await transitionFulfillment(db, { orderId, to: 'CLOSED', actorId: 'us_admin_seed' });
    const row = await getOrder(db, orderId);
    expect(row.fulfillmentStatus).toBe('CLOSED');
    expect(row.paymentStatus).toBe('PAID');

    // CLOSED is the immutable archive
    expect(await codeOf(transitionFulfillment(db, { orderId, to: 'SHIPPED', actorId: 'us_admin_seed' }))).toBe(
      'ORDER_IMMUTABLE',
    );

    const events = await listOrderEvents(db, orderId);
    // CREATED + PREPARING + PREPARED + SHIPPED + DELIVERED + PAYMENT + CLOSED = 7
    // (the refused close attempt correctly leaves no trace)
    expect(events.length).toBeGreaterThanOrEqual(7);
    expect(events.map((e) => e.id)).toEqual([...events.map((e) => e.id)].sort((a, b) => a - b));
    const audits = await db.select().from(auditLog).where(eq(auditLog.entityId, orderId)).all();
    expect(audits.length).toBeGreaterThanOrEqual(6); // every admin move is compliance-logged
  });

  it('supports the UPI-QR story: customer attests, admin reconciles or rejects', async () => {
    const { orderId } = await createLabOrder(db, labInput({ paymentMethod: 'UPI_QR' }));
    await markPayment(db, { orderId, to: 'AWAITING_VERIFICATION', note: 'customer tapped “I have paid”' });
    // admin cannot find it in the bank statement → back to UNPAID, no refund object exists
    await markPayment(db, { orderId, to: 'UNPAID', actorId: 'us_admin_seed', note: 'not visible in statement' });
    // customer pays again properly
    await markPayment(db, { orderId, to: 'AWAITING_VERIFICATION' });
    await markPayment(db, { orderId, to: 'PAID', actorId: 'us_admin_seed', note: 'UTR matched' });
    expect((await getOrder(db, orderId)).paymentStatus).toBe('PAID');
    expect(await codeOf(markPayment(db, { orderId, to: 'UNPAID', actorId: 'us_admin_seed' }))).toBe(
      'ILLEGAL_PAYMENT_TRANSITION',
    ); // PAID is terminal
  });

  it('cancels inside the window, refunds the credit, then becomes immutable', async () => {
    const { orderId } = await createLabOrder(db, labInput({ userId: 'us_cust_cancel', wantFreeDelivery: true }));
    expect(await creditsOf('us_cust_cancel')).toBe(0);
    await cancelOrder(db, { orderId, actorId: 'us_cust_cancel', note: 'ordered twice by mistake' });
    expect((await getOrder(db, orderId)).fulfillmentStatus).toBe('CANCELLED');
    expect(await creditsOf('us_cust_cancel')).toBe(1); // refunded
    const events = await listOrderEvents(db, orderId);
    expect(events.some((e) => e.action === 'CREDIT_REFUND')).toBe(true);
    const stockMovements = await db
      .select()
      .from(inventoryMovements)
      .where(eq(inventoryMovements.orderId, orderId))
      .all();
    expect(stockMovements.filter((movement) => movement.reason === 'CONSUMED_BY_ORDER')).toHaveLength(
      everydayItems.length,
    );
    expect(stockMovements.filter((movement) => movement.reason === 'RETURN_TO_STOCK')).toHaveLength(
      everydayItems.length,
    );
    expect(stockMovements.reduce((sum, movement) => sum + movement.deltaG, 0)).toBe(0);
    expect(await codeOf(cancelOrder(db, { orderId }))).toBe('ORDER_IMMUTABLE');
  });

  it('refuses cancellation once PREPARED — the mill has already run', async () => {
    const { orderId } = await createLabOrder(db, labInput());
    await transitionFulfillment(db, { orderId, to: 'PREPARING', actorId: 'us_admin_seed' });
    await transitionFulfillment(db, { orderId, to: 'PREPARED', actorId: 'us_admin_seed' });
    expect(await codeOf(cancelOrder(db, { orderId }))).toBe('ILLEGAL_FULFILLMENT_TRANSITION');
  });

  it('handles the failed-delivery path: SHIPPED → DELIVERY_FAILED → RTO → CLOSED without payment', async () => {
    const { orderId } = await createLabOrder(db, labInput());
    for (const to of ['PREPARING', 'PREPARED', 'SHIPPED', 'DELIVERY_FAILED', 'RTO', 'CLOSED']) {
      await transitionFulfillment(db, { orderId, to, actorId: 'us_admin_seed' });
    }
    const row = await getOrder(db, orderId);
    expect(row.fulfillmentStatus).toBe('CLOSED');
    expect(row.paymentStatus).toBe('UNPAID'); // COD never moved money; goods came home
  });

  it('rejects unknown orders and unknown statuses with typed codes', async () => {
    expect(await codeOf(transitionFulfillment(db, { orderId: 'od_nope', to: 'SHIPPED' }))).toBe('ORDER_NOT_FOUND');
    expect(await codeOf(markPayment(db, { orderId: 'od_nope', to: 'PAID' }))).toBe('ORDER_NOT_FOUND');
    expect(await codeOf(cancelOrder(db, { orderId: 'od_nope' }))).toBe('ORDER_NOT_FOUND');
    expect(await codeOf(listOrderEvents(db, 'od_nope'))).toBe('ORDER_NOT_FOUND');
    const { orderId } = await createLabOrder(db, labInput());
    expect(await codeOf(transitionFulfillment(db, { orderId, to: 'TELEPORTED' }))).toBe(
      'ILLEGAL_FULFILLMENT_TRANSITION',
    );
    expect(await codeOf(markPayment(db, { orderId, to: 'REFUNDED' }))).toBe('ILLEGAL_PAYMENT_TRANSITION');
  });
});

describe('premade orders', () => {
  it('prices the shelf variant all-inclusive and re-derives the GST split', async () => {
    const created = await createPremadeOrder(db, premadeInput());
    expect(created.totalPaise).toBe(100000); // ₹950 shelf + ₹50 delivery
    const row = await getOrder(db, created.orderId);
    expect(row.kind).toBe('PREMADE');
    expect(row.rawPaise).toBe(95000);
    expect(row.millingPaise).toBe(0); // milling/packaging live inside the shelf price
    expect(row.packagingPaise).toBe(0);
    expect(row.gstPaise).toBe(4524);
    expect(row.cgstPaise).toBe(2262);
    expect(row.sgstPaise).toBe(2262);

    const snap = JSON.parse(row.itemsSnapshot) as PremadeSnapshot;
    expect(snap.lines).toHaveLength(1); // ONE money line — no fabricated per-ingredient prices
    expect(snap.lines[0]?.displayPercent).toBe('100.00%');
    expect(snap.composition.reduce((a, c) => a + c.bps, 0)).toBe(10000); // exact-% still travels with the order
    expect(snap.ingredientUsage?.reduce((sum, line) => sum + line.grams, 0)).toBe(10000);
    const movements = await db
      .select()
      .from(inventoryMovements)
      .where(eq(inventoryMovements.orderId, created.orderId))
      .all();
    expect(movements.reduce((sum, movement) => sum + movement.deltaG, 0)).toBe(-10000);
  });

  it('scales by package count and refuses invalid variants or tenancy', async () => {
    const two = await createPremadeOrder(db, premadeInput({ packageCount: 2 }));
    expect(two.snapshot.rawPaise).toBe(190000);
    expect(two.totalPaise).toBe(195000);
    expect(two.snapshot.ingredientUsage?.reduce((sum, line) => sum + line.grams, 0)).toBe(20000);
    const movements = await db
      .select()
      .from(inventoryMovements)
      .where(eq(inventoryMovements.orderId, two.orderId))
      .all();
    expect(movements.reduce((sum, movement) => sum + movement.deltaG, 0)).toBe(-20000);
    expect(await codeOf(createPremadeOrder(db, premadeInput({ packageCount: 0 })))).toBe('INVALID_QUANTITY');
    expect(await codeOf(createPremadeOrder(db, premadeInput({ packSizeG: 7000 })))).toBe('VARIANT_NOT_FOUND');
    expect(await codeOf(createPremadeOrder(db, premadeInput({ productId: 'pr_nope' })))).toBe('VARIANT_NOT_FOUND');
    // tenancy: a valid product id under the WRONG store is simply "not found"
    expect(await codeOf(createPremadeOrder(db, premadeInput({ storeId: 'st_other' })))).toBe('VARIANT_NOT_FOUND');
  });

  it('freezes an item coupon, records a redemption, and ignores cancelled orders in usage limits', async () => {
    await db.insert(coupons).values({
      id: 'cp_order10',
      storeId: SEED_STORE_ID,
      code: 'ORDER10',
      type: 'PERCENT',
      value: 1000,
      minOrderPaise: null,
      maxDiscountPaise: 5000,
      usageLimit: 2,
      perUserLimit: 1,
      startsAt: null,
      expiresAt: null,
      active: true,
      createdBy: 'us_cust_credit',
    });
    const first = await createPremadeOrder(db, premadeInput({ userId: 'us_cust_zero', couponCode: 'order10' }));
    expect(first.snapshot.coupon).toEqual({ code: 'ORDER10', type: 'PERCENT', discountPaise: 5000 });
    expect(first.snapshot.subtotalPaise).toBe(90000);
    expect(first.totalPaise).toBe(95000);
    const row = await getOrder(db, first.orderId);
    expect(row.couponId).toBe('cp_order10');
    expect(row.couponDiscountPaise).toBe(5000);
    expect(
      await db.select().from(couponRedemptions).where(eq(couponRedemptions.orderId, first.orderId)).all(),
    ).toHaveLength(1);
    expect(
      await couponCodeOf(createPremadeOrder(db, premadeInput({ userId: 'us_cust_zero', couponCode: 'ORDER10' }))),
    ).toBe('USER_LIMIT');

    await cancelOrder(db, { orderId: first.orderId });
    const second = await createPremadeOrder(db, premadeInput({ userId: 'us_cust_zero', couponCode: 'ORDER10' }));
    expect(second.snapshot.coupon?.code).toBe('ORDER10');
    // The cancellation did not erase its immutable redemption record.
    expect(
      await db.select().from(couponRedemptions).where(eq(couponRedemptions.couponId, 'cp_order10')).all(),
    ).toHaveLength(2);
  });

  it('free-delivery coupons waive delivery without reducing the GST-inclusive item subtotal', async () => {
    await db.insert(coupons).values({
      id: 'cp_shipfree',
      storeId: SEED_STORE_ID,
      code: 'SHIPFREE',
      type: 'FREE_DELIVERY',
      value: 0,
      minOrderPaise: null,
      maxDiscountPaise: null,
      usageLimit: null,
      perUserLimit: null,
      startsAt: null,
      expiresAt: null,
      active: true,
      createdBy: 'us_cust_credit',
    });
    const created = await createPremadeOrder(db, premadeInput({ userId: 'us_cust_zero', couponCode: 'SHIPFREE' }));
    expect(created.snapshot.subtotalPaise).toBe(95000);
    expect(created.snapshot.deliveryPaise).toBe(0);
    expect(created.snapshot.deliveryWaived).toBe(true);
    expect(created.snapshot.totalPaise).toBe(95000);
    expect(created.snapshot.coupon?.discountPaise).toBe(5000);
    expect(await creditsOf('us_cust_zero')).toBe(0);
  });

  it('refuses checkout of a deactivated product or pack variant', async () => {
    await db.update(products).set({ status: 'inactive' }).where(eq(products.id, 'pr_everyday'));
    try {
      expect(await codeOf(createPremadeOrder(db, premadeInput()))).toBe('VARIANT_NOT_FOUND');
    } finally {
      await db.update(products).set({ status: 'active' }).where(eq(products.id, 'pr_everyday'));
    }

    await db.update(productVariants).set({ active: false }).where(eq(productVariants.productId, 'pr_everyday'));
    try {
      expect(await codeOf(createPremadeOrder(db, premadeInput()))).toBe('VARIANT_NOT_FOUND');
    } finally {
      await db.update(productVariants).set({ active: true }).where(eq(productVariants.productId, 'pr_everyday'));
    }
  });
});
