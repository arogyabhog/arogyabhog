import { describe, expect, it } from 'vitest';
import { parseStoreSettings } from './store-settings-validation';

const valid = {
  storeId: 'st_knp_01',
  name: 'ArogyaBhog Kanpur',
  city: 'Kanpur, UP',
  upiVpa: 'arogyabhog@upi',
  deliveryFeeRupees: '50.00',
  packagingFeeRupees: '5',
  millingFeeRupeesPerKg: '4.00',
  gstRateBps: '500',
  priceConsistencyToleranceBps: '500',
  minBaseGrainBps: '6000',
  referralCreditCap: '10',
  refereeBonusCredits: '1',
  allowedPackSizesG: '5000,10000,15000,20000',
};

describe('store settings validation', () => {
  it('parses rupees into integer paise and pack sizes into sorted integer grams', () => {
    const parsed = parseStoreSettings(valid);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.deliveryFeeRupees).toBe(5000);
    expect(parsed.data.packagingFeeRupees).toBe(500);
    expect(parsed.data.millingFeeRupeesPerKg).toBe(400);
    expect(parsed.data.allowedPackSizesG).toEqual([5000, 10000, 15000, 20000]);
  });

  it('allows zero fees and keeps basis-point settings integer-bounded', () => {
    const parsed = parseStoreSettings({
      ...valid,
      deliveryFeeRupees: '0',
      packagingFeeRupees: '0.00',
      millingFeeRupeesPerKg: '0',
      gstRateBps: '0',
      minBaseGrainBps: '10000',
    });
    expect(parsed.success).toBe(true);
  });

  it.each(['5000,5000', '6000', '5000,10001', ''])('rejects invalid pack-size sets: %s', (packSizes) => {
    expect(parseStoreSettings({ ...valid, allowedPackSizesG: packSizes }).success).toBe(false);
  });

  it('rejects invalid VPA, fractional basis points, and out-of-range rates', () => {
    expect(parseStoreSettings({ ...valid, upiVpa: 'not-a-vpa' }).success).toBe(false);
    expect(parseStoreSettings({ ...valid, gstRateBps: '500.5' }).success).toBe(false);
    expect(parseStoreSettings({ ...valid, priceConsistencyToleranceBps: '10001' }).success).toBe(false);
  });
});
