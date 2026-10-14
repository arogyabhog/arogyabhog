export type CouponType = 'PERCENT' | 'FLAT' | 'FREE_DELIVERY';
export type CouponFailure =
  | 'INACTIVE'
  | 'NOT_STARTED'
  | 'EXPIRED'
  | 'MINIMUM_NOT_MET'
  | 'NO_DISCOUNT'
  | 'USAGE_LIMIT'
  | 'USER_LIMIT'
  | 'NOT_FOUND'
  | 'ACCOUNT_REQUIRED'
  | 'TERMS_CHANGED';

export class CouponError extends Error {
  constructor(readonly code: CouponFailure) {
    super(code);
    this.name = 'CouponError';
  }
}

export interface CouponRule {
  type: CouponType;
  value: number;
  minOrderPaise: number | null;
  maxDiscountPaise: number | null;
  startsAt: number | null;
  expiresAt: number | null;
  active: boolean;
}

export interface CouponApplication {
  discountPaise: number;
  itemDiscountPaise: number;
  netSubtotalPaise: number;
  deliveryPaise: number;
  deliveryWaived: boolean;
  totalPaise: number;
}

export type CouponResult = { ok: true; application: CouponApplication } | { ok: false; reason: CouponFailure };

/** Integer-paise discount arithmetic. Item discounts reduce the GST-inclusive item subtotal; delivery remains separate. */
export function applyCoupon(
  coupon: CouponRule,
  input: { subtotalPaise: number; deliveryFeePaise: number; now?: number },
): CouponResult {
  const now = input.now ?? Date.now();
  if (!coupon.active) return { ok: false, reason: 'INACTIVE' };
  if (coupon.startsAt !== null && coupon.startsAt > now) return { ok: false, reason: 'NOT_STARTED' };
  if (coupon.expiresAt !== null && coupon.expiresAt < now) return { ok: false, reason: 'EXPIRED' };
  if (coupon.minOrderPaise !== null && input.subtotalPaise < coupon.minOrderPaise) {
    return { ok: false, reason: 'MINIMUM_NOT_MET' };
  }

  let discountPaise: number;
  let itemDiscountPaise: number;
  let deliveryWaived = false;
  if (coupon.type === 'PERCENT') {
    const computed = Number((BigInt(input.subtotalPaise) * BigInt(coupon.value)) / 10000n);
    discountPaise = Math.min(computed, coupon.maxDiscountPaise ?? computed, input.subtotalPaise);
    itemDiscountPaise = discountPaise;
  } else if (coupon.type === 'FLAT') {
    discountPaise = Math.min(coupon.value, coupon.maxDiscountPaise ?? coupon.value, input.subtotalPaise);
    itemDiscountPaise = discountPaise;
  } else {
    deliveryWaived = true;
    discountPaise = input.deliveryFeePaise;
    itemDiscountPaise = 0;
  }

  if (discountPaise < 1 && coupon.type !== 'FREE_DELIVERY') return { ok: false, reason: 'NO_DISCOUNT' };
  const netSubtotalPaise = input.subtotalPaise - itemDiscountPaise;
  const deliveryPaise = deliveryWaived ? 0 : input.deliveryFeePaise;
  return {
    ok: true,
    application: {
      discountPaise,
      itemDiscountPaise,
      netSubtotalPaise,
      deliveryPaise,
      deliveryWaived,
      totalPaise: netSubtotalPaise + deliveryPaise,
    },
  };
}
