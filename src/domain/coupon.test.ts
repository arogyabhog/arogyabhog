import { describe, expect, it } from 'vitest';
import { applyCoupon, type CouponRule } from './coupon';

const reasonOf = (result: ReturnType<typeof applyCoupon>) => (result.ok ? null : result.reason);

const base: CouponRule = {
  type: 'PERCENT',
  value: 2000,
  minOrderPaise: 50000,
  maxDiscountPaise: 10000,
  startsAt: null,
  expiresAt: null,
  active: true,
};

describe('coupon arithmetic and eligibility', () => {
  it('applies percentage on GST-inclusive item price and observes the paise cap', () => {
    expect(applyCoupon(base, { subtotalPaise: 95000, deliveryFeePaise: 5000 })).toEqual({
      ok: true,
      application: {
        discountPaise: 10000,
        itemDiscountPaise: 10000,
        netSubtotalPaise: 85000,
        deliveryPaise: 5000,
        deliveryWaived: false,
        totalPaise: 90000,
      },
    });
  });

  it('caps flat coupons at the item subtotal so the amount never goes negative', () => {
    expect(
      applyCoupon(
        { ...base, type: 'FLAT', value: 120000, maxDiscountPaise: null },
        {
          subtotalPaise: 95000,
          deliveryFeePaise: 5000,
        },
      ),
    ).toMatchObject({ ok: true, application: { discountPaise: 95000, netSubtotalPaise: 0, totalPaise: 5000 } });
  });

  it('free-delivery coupons waive delivery without reducing taxable item price', () => {
    expect(
      applyCoupon(
        { ...base, type: 'FREE_DELIVERY', value: 0, maxDiscountPaise: null },
        {
          subtotalPaise: 95000,
          deliveryFeePaise: 5000,
        },
      ),
    ).toMatchObject({
      ok: true,
      application: {
        discountPaise: 5000,
        itemDiscountPaise: 0,
        netSubtotalPaise: 95000,
        deliveryPaise: 0,
        deliveryWaived: true,
        totalPaise: 95000,
      },
    });
  });

  it('checks active state, start/end time, and minimum amount', () => {
    expect(reasonOf(applyCoupon({ ...base, active: false }, { subtotalPaise: 95000, deliveryFeePaise: 5000 }))).toBe(
      'INACTIVE',
    );
    expect(
      reasonOf(applyCoupon({ ...base, startsAt: 200 }, { subtotalPaise: 95000, deliveryFeePaise: 5000, now: 100 })),
    ).toBe('NOT_STARTED');
    expect(
      reasonOf(applyCoupon({ ...base, expiresAt: 50 }, { subtotalPaise: 95000, deliveryFeePaise: 5000, now: 100 })),
    ).toBe('EXPIRED');
    expect(reasonOf(applyCoupon(base, { subtotalPaise: 49999, deliveryFeePaise: 5000 }))).toBe('MINIMUM_NOT_MET');
  });

  it('uses integer paise arithmetic and rejects a rounded-to-zero item discount', () => {
    expect(
      reasonOf(
        applyCoupon(
          { ...base, value: 1, minOrderPaise: null, maxDiscountPaise: null },
          { subtotalPaise: 100, deliveryFeePaise: 0 },
        ),
      ),
    ).toBe('NO_DISCOUNT');
  });
});
