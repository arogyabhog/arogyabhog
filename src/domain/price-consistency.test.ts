import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { compareRecipePrice, priceRecipeRebuild } from './price-consistency';

const FEES = { millingFeePaisePerKg: 400, packagingFeePaise: 500, gstRateBps: 500 };

describe('premade price consistency', () => {
  it('rebuilds a one-ingredient pack with the same integer fees and GST-inclusive subtotal', () => {
    const result = priceRecipeRebuild(
      [{ ingredientId: 'wheat', ratioBps: 10000, sellPaisePerKg: 10000, provisional: false }],
      10000,
      1,
      FEES,
    );
    expect(result).toEqual({
      rawPaise: 100000,
      millingPaise: 4000,
      packagingPaise: 500,
      gstPaise: 4976,
      equivalentPaise: 104500,
      provisionalPricing: false,
    });
  });

  it('scales blend ratios to exact pack grams and handles multiple pouch fees', () => {
    const result = priceRecipeRebuild(
      [
        { ingredientId: 'wheat', ratioBps: 6000, sellPaisePerKg: 10000, provisional: false },
        { ingredientId: 'chana', ratioBps: 4000, sellPaisePerKg: 20000, provisional: true },
      ],
      15000,
      2,
      FEES,
    );
    expect(result.rawPaise).toBe(210000);
    expect(result.millingPaise).toBe(6000);
    expect(result.packagingPaise).toBe(1000);
    expect(result.equivalentPaise).toBe(217000);
    expect(result.provisionalPricing).toBe(true);
  });

  it('rejects missing rates and recipes that do not total 100%', () => {
    expect(() => priceRecipeRebuild([], 10000, 1, FEES)).toThrow(/10,000/);
    expect(() =>
      priceRecipeRebuild(
        [{ ingredientId: 'a', ratioBps: 9000, sellPaisePerKg: 10000, provisional: false }],
        10000,
        1,
        FEES,
      ),
    ).toThrow(/10,000/);
    expect(() =>
      priceRecipeRebuild(
        [{ ingredientId: 'a', ratioBps: 10000, sellPaisePerKg: 0, provisional: false }],
        10000,
        1,
        FEES,
      ),
    ).toThrow(/positive integer/);
  });

  it('uses the standard shelf price denominator and the configured tolerance', () => {
    expect(compareRecipePrice(105000, 100000, 500, false)).toMatchObject({
      differencePaise: 5000,
      differenceBps: 500,
      outsideTolerance: false,
      needsReview: false,
    });
    expect(compareRecipePrice(106000, 100000, 500, false)).toMatchObject({
      differenceBps: 600,
      outsideTolerance: true,
      needsReview: true,
    });
    expect(compareRecipePrice(99000, 100000, 500, true).needsReview).toBe(true);
  });

  it('compares generated safe prices without floating-point drift', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 9_000_000 }), fc.integer({ min: 0, max: 1000 }), (shelf, gap) => {
        const result = compareRecipePrice(shelf + gap, shelf, 10000, false);
        expect(result.differencePaise).toBe(gap);
        const expectedBps = Number((2n * BigInt(gap) * 10000n + BigInt(shelf)) / (2n * BigInt(shelf)));
        expect(result.differenceBps).toBe(expectedBps);
      }),
      { numRuns: 1000 },
    );
  });
});
