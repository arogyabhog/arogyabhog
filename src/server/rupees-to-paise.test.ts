import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { rupeesToPaise } from './rupees-to-paise';

describe('rupeesToPaise', () => {
  it('converts decimal rupee strings exactly', () => {
    expect(rupeesToPaise('0.01')).toBe(1);
    expect(rupeesToPaise('12.3')).toBe(1230);
    expect(rupeesToPaise('12.30')).toBe(1230);
    expect(rupeesToPaise('1250')).toBe(125000);
    expect(rupeesToPaise('9999999.99')).toBe(999999999);
  });

  it('rejects empty, zero, signed, exponent, over-precision, and malformed values', () => {
    for (const value of ['', '0', '0.00', '-1', '+1', '1e3', '1.001', '1,000', ' 10', '10 ']) {
      expect(rupeesToPaise(value)).toBeNull();
    }
  });

  it('round-trips generated whole and fractional rupees without drift', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 9_999_999 }), fc.integer({ min: 0, max: 99 }), (whole, cents) => {
        const centsText = String(cents).padStart(2, '0');
        const parsed = rupeesToPaise(`${whole}.${centsText}`);
        const expected = whole * 100 + cents;
        expect(parsed).toBe(expected === 0 ? null : expected);
      }),
      { numRuns: 1000 },
    );
  });
});
