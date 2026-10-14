import { describe, expect, it } from 'vitest';
import { parseCouponSettings } from './coupon-validation';

const valid = {
  storeId: 'st_knp_01',
  code: 'SAVE20',
  type: 'PERCENT',
  valueBps: '2000',
  valueRupees: '0',
  minOrderRupees: '500',
  maxDiscountRupees: '50',
  usageLimit: '100',
  perUserLimit: '1',
  expiresOn: '2027-12-31',
};

describe('coupon settings validation', () => {
  it('normalizes codes and converts money and limits to integer fields', () => {
    const parsed = parseCouponSettings({ ...valid, code: ' save20 ' }, 'MANAGER');
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.code).toBe('SAVE20');
    expect(parsed.data.value).toBe(2000);
    expect(parsed.data.minOrderPaise).toBe(50000);
    expect(parsed.data.maxDiscountPaise).toBe(5000);
    expect(parsed.data.usageLimit).toBe(100);
    expect(parsed.data.perUserLimit).toBe(1);
  });

  it('caps manager percent discounts at 50% and ₹50 maximum discount', () => {
    expect(parseCouponSettings({ ...valid, valueBps: '5001' }, 'MANAGER').success).toBe(false);
    expect(parseCouponSettings({ ...valid, maxDiscountRupees: '50.01' }, 'MANAGER').success).toBe(false);
  });

  it('allows the owner to create a percent offer above the manager cap', () => {
    expect(parseCouponSettings({ ...valid, valueBps: '7500' }, 'ADMIN').success).toBe(true);
  });

  it('caps manager flat discounts at ₹50 and accepts a valid flat coupon', () => {
    const flat = { ...valid, type: 'FLAT', valueBps: '0', valueRupees: '50', maxDiscountRupees: '' };
    expect(parseCouponSettings(flat, 'MANAGER').success).toBe(true);
    expect(parseCouponSettings({ ...flat, valueRupees: '50.01' }, 'MANAGER').success).toBe(false);
  });

  it('accepts free delivery with no product discount amount', () => {
    const freeDelivery = { ...valid, type: 'FREE_DELIVERY', valueBps: '0', valueRupees: '0', maxDiscountRupees: '' };
    expect(parseCouponSettings(freeDelivery, 'MANAGER').success).toBe(true);
  });

  it.each(['ab', 'SAVE SPACE', 'SAVE@20', ''])('rejects unsafe coupon codes: %s', (code) => {
    expect(parseCouponSettings({ ...valid, code }, 'ADMIN').success).toBe(false);
  });
});
