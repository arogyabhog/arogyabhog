import { describe, expect, it } from 'vitest';
import { parseManualInventoryMovement } from './inventory-validation';

const valid = {
  storeId: 'st_knp_01',
  ingredientId: 'RM-001',
  reason: 'PURCHASE',
  deltaG: '10000',
  note: 'Opening stock count',
};

describe('manual inventory movement validation', () => {
  it('accepts a positive purchase movement', () => {
    const parsed = parseManualInventoryMovement(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.deltaG).toBe(10000);
  });

  it('accepts negative wastage and signed adjustments', () => {
    expect(parseManualInventoryMovement({ ...valid, reason: 'WASTAGE', deltaG: '-50' }).success).toBe(true);
    expect(parseManualInventoryMovement({ ...valid, reason: 'ADJUSTMENT', deltaG: '-50' }).success).toBe(true);
    expect(parseManualInventoryMovement({ ...valid, reason: 'ADJUSTMENT', deltaG: '50' }).success).toBe(true);
  });

  it.each([
    { reason: 'PURCHASE', deltaG: '-1' },
    { reason: 'WASTAGE', deltaG: '1' },
    { reason: 'ADJUSTMENT', deltaG: '0' },
    { reason: 'CONSUMED_BY_ORDER', deltaG: '-1' },
    { reason: 'PURCHASE', deltaG: '1.5' },
    { reason: 'PURCHASE', deltaG: '100000000' },
  ])('rejects invalid movement $reason/$deltaG', (over) => {
    expect(parseManualInventoryMovement({ ...valid, ...over }).success).toBe(false);
  });
});
