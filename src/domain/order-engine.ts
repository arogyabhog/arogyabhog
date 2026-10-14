/**
 * Order domain (ADR-027): two closed state machines over a frozen money
 * snapshot. Pure — no I/O, no DB, no dates. Mirrors mix-engine discipline:
 * closed error-code union, bigint money, every rule table-driven and tested
 * as a full matrix.
 */
import { roundHalfUp } from './mix-engine';

/* ------------------------------------------------------------------ */
/* Statuses                                                            */
/* ------------------------------------------------------------------ */

export const FULFILLMENT_STATUSES = [
  'PLACED',
  'PREPARING',
  'PREPARED',
  'SHIPPED',
  'DELIVERED',
  'DELIVERY_FAILED',
  'RTO',
  'CLOSED',
  'CANCELLED',
] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export const PAYMENT_STATUSES = ['UNPAID', 'AWAITING_VERIFICATION', 'PAID'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['COD', 'UPI_QR'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ORDER_KINDS = ['LAB', 'PREMADE'] as const;
export type OrderKind = (typeof ORDER_KINDS)[number];

/** ADR-011/012 transition table, as data. CLOSED/CANCELLED are terminal. */
export const FULFILLMENT_TRANSITIONS: Readonly<Record<FulfillmentStatus, readonly FulfillmentStatus[]>> = {
  PLACED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['PREPARED', 'CANCELLED'],
  PREPARED: ['SHIPPED'],
  SHIPPED: ['DELIVERED', 'DELIVERY_FAILED'],
  DELIVERY_FAILED: ['SHIPPED', 'RTO'],
  RTO: ['CLOSED'],
  DELIVERED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};

/** COD: UNPAID→PAID at delivery. UPI_QR: customer attests → admin reconciles. */
export const PAYMENT_TRANSITIONS: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
  UNPAID: ['AWAITING_VERIFICATION', 'PAID'],
  AWAITING_VERIFICATION: ['PAID', 'UNPAID'], // admin rejects an unverifiable claim
  PAID: [],
};

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export type OrderErrorCode =
  | 'ORDER_NOT_FOUND'
  | 'VARIANT_NOT_FOUND'
  | 'ORDER_IMMUTABLE'
  | 'ILLEGAL_FULFILLMENT_TRANSITION'
  | 'ILLEGAL_PAYMENT_TRANSITION'
  | 'CLOSE_REQUIRES_PAID'
  | 'CREDIT_NOT_AVAILABLE'
  | 'SNAPSHOT_INCONSISTENT'
  | 'UNKNOWN_PAYMENT_METHOD'
  | 'INVALID_QUANTITY';

export class OrderError extends Error {
  constructor(
    readonly code: OrderErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'OrderError';
  }
}

/* ------------------------------------------------------------------ */
/* State machines                                                      */
/* ------------------------------------------------------------------ */

/** Cancellation window is exactly PLACED/PREPARING (spec: pre-PREPARED). */
export function canCancel(status: FulfillmentStatus): boolean {
  return status === 'PLACED' || status === 'PREPARING';
}

export function assertFulfillmentTransition(
  from: FulfillmentStatus,
  to: FulfillmentStatus,
  ctx: { paymentStatus: PaymentStatus },
): void {
  if (from === 'CLOSED' || from === 'CANCELLED') {
    throw new OrderError('ORDER_IMMUTABLE', `Order is ${from} — archived orders never move again.`, { from, to });
  }
  if (!FULFILLMENT_TRANSITIONS[from].includes(to)) {
    throw new OrderError('ILLEGAL_FULFILLMENT_TRANSITION', `Cannot move ${from} → ${to}.`, {
      from,
      to,
      allowed: FULFILLMENT_TRANSITIONS[from],
    });
  }
  // ADR-027 rule 4: CLOSED is the immutable archive — never archive money ambiguity.
  if (from === 'DELIVERED' && to === 'CLOSED' && ctx.paymentStatus !== 'PAID') {
    throw new OrderError('CLOSE_REQUIRES_PAID', 'A delivered order closes only after payment is confirmed.', {
      paymentStatus: ctx.paymentStatus,
    });
  }
}

export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!PAYMENT_TRANSITIONS[from].includes(to)) {
    throw new OrderError('ILLEGAL_PAYMENT_TRANSITION', `Cannot move payment ${from} → ${to}.`, {
      from,
      to,
      allowed: PAYMENT_TRANSITIONS[from],
    });
  }
}

export function assertPaymentMethod(m: string): asserts m is PaymentMethod {
  if (!(PAYMENT_METHODS as readonly string[]).includes(m)) {
    throw new OrderError('UNKNOWN_PAYMENT_METHOD', `Unknown payment method "${m}".`, { method: m });
  }
}

/* ------------------------------------------------------------------ */
/* Money                                                               */
/* ------------------------------------------------------------------ */

/** GST re-derivation from a GST-INCLUSIVE amount — the engine's own formula. */
export function gstSplitInclusive(
  subtotalPaise: number,
  gstRateBps: number,
): {
  gstPaise: number;
  cgstPaise: number;
  sgstPaise: number;
} {
  const gst = roundHalfUp(BigInt(subtotalPaise) * BigInt(gstRateBps), 10000n + BigInt(gstRateBps));
  const cgst = gst / 2n; // floor
  return { gstPaise: Number(gst), cgstPaise: Number(cgst), sgstPaise: Number(gst - cgst) };
}

export interface DeliveryInput {
  subtotalPaise: number; // GST-inclusive goods subtotal
  deliveryFeePaise: number; // store's quoted fee
  wantFreeDelivery: boolean;
  creditsAvailable: number;
}
export interface DeliveryDecision {
  deliveryPaise: number; // charged (0 when waived)
  deliveryWaived: boolean;
  totalPaise: number;
}

/** ADR-027 rule 5: opt-in redemption, exactly one credit, refundable on cancel. */
export function decideDelivery(input: DeliveryInput): DeliveryDecision {
  if (input.wantFreeDelivery && input.creditsAvailable < 1) {
    throw new OrderError('CREDIT_NOT_AVAILABLE', 'No free-delivery credit left to redeem.', {
      creditsAvailable: input.creditsAvailable,
    });
  }
  const waived = input.wantFreeDelivery && input.creditsAvailable >= 1;
  const deliveryPaise = waived ? 0 : input.deliveryFeePaise;
  return { deliveryPaise, deliveryWaived: waived, totalPaise: input.subtotalPaise + deliveryPaise };
}

/* ------------------------------------------------------------------ */
/* Frozen snapshot                                                     */
/* ------------------------------------------------------------------ */

export interface SnapshotLine {
  name: string;
  weightG: number;
  displayPercent: string;
  linePaise: number;
}

export interface OrderSnapshot {
  kind: OrderKind;
  packSizeG: number;
  packageCount: number;
  lines: SnapshotLine[];
  rawPaise: number;
  millingPaise: number;
  packagingPaise: number;
  subtotalPaise: number; // GST-inclusive
  gstRateBps: number;
  gstPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  deliveryFeePaise: number; // quoted
  deliveryPaise: number; // charged
  deliveryWaived: boolean;
  totalPaise: number;
  ratesProvisional: boolean;
  /** Exact ingredient grams reserved at placement; kept in the frozen order snapshot. */
  ingredientUsage?: Array<{ ingredientId: string; grams: number }>;
  /** LAB only: provenance per ADR-007, frozen with the order. */
  nutritionSources?: string[];
}

/** Re-checks every money invariant of a snapshot. Throws SNAPSHOT_INCONSISTENT. */
export function assertSnapshotConsistent(s: OrderSnapshot): void {
  const bad = (why: string) => {
    throw new OrderError('SNAPSHOT_INCONSISTENT', `Snapshot is inconsistent: ${why}`, { why });
  };
  if (s.packageCount < 1 || !Number.isInteger(s.packageCount)) bad('packageCount must be a positive integer');
  if (s.ingredientUsage !== undefined) {
    const ids = s.ingredientUsage.map((line) => line.ingredientId);
    if (ids.length === 0 || new Set(ids).size !== ids.length) bad('ingredientUsage must have unique ingredient IDs');
    if (s.ingredientUsage.some((line) => !Number.isSafeInteger(line.grams) || line.grams < 1)) {
      bad('ingredientUsage grams must be positive safe integers');
    }
    const usageSum = s.ingredientUsage.reduce((sum, line) => sum + BigInt(line.grams), 0n);
    if (usageSum !== BigInt(s.packSizeG) * BigInt(s.packageCount))
      bad('ingredientUsage must equal pack weight × package count');
  }
  const linesSum = s.lines.reduce((a, l) => a + BigInt(l.linePaise), 0n);
  if (linesSum !== BigInt(s.rawPaise)) bad(`Σ linePaise (${linesSum}) ≠ rawPaise (${s.rawPaise})`);
  if (BigInt(s.rawPaise) + BigInt(s.millingPaise) + BigInt(s.packagingPaise) !== BigInt(s.subtotalPaise)) {
    bad('raw + milling + packaging ≠ subtotal');
  }
  const gst = gstSplitInclusive(s.subtotalPaise, s.gstRateBps);
  if (gst.gstPaise !== s.gstPaise || gst.cgstPaise !== s.cgstPaise || gst.sgstPaise !== s.sgstPaise) {
    bad('GST split does not match the inclusive-subtotal formula');
  }
  const expectedDelivery = s.deliveryWaived ? 0 : s.deliveryFeePaise;
  if (s.deliveryPaise !== expectedDelivery) bad('deliveryPaise disagrees with deliveryWaived');
  if (BigInt(s.subtotalPaise) + BigInt(s.deliveryPaise) !== BigInt(s.totalPaise)) bad('subtotal + delivery ≠ total');
}
