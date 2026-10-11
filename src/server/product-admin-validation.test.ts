import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { validRecipeRatios } from './product-admin-validation';

describe('product recipe admin validation', () => {
  it('accepts complete, exact-total integer recipes', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 9999 }), (first) => {
        const second = 10000 - first;
        expect(
          validRecipeRatios(
            ['grain-a', 'grain-b'],
            [
              { ingredientId: 'grain-a', ratioBps: first },
              { ingredientId: 'grain-b', ratioBps: second },
            ],
          ),
        ).toBe(true);
      }),
      { numRuns: 1000 },
    );
  });

  it('rejects missing, duplicate, unexpected, fractional, or non-100% rows', () => {
    expect(validRecipeRatios(['a', 'b'], [{ ingredientId: 'a', ratioBps: 10000 }])).toBe(false);
    expect(
      validRecipeRatios(
        ['a', 'b'],
        [
          { ingredientId: 'a', ratioBps: 5000 },
          { ingredientId: 'a', ratioBps: 5000 },
        ],
      ),
    ).toBe(false);
    expect(
      validRecipeRatios(
        ['a', 'b'],
        [
          { ingredientId: 'a', ratioBps: 5000 },
          { ingredientId: 'other', ratioBps: 5000 },
        ],
      ),
    ).toBe(false);
    expect(
      validRecipeRatios(
        ['a', 'b'],
        [
          { ingredientId: 'a', ratioBps: 4999.5 },
          { ingredientId: 'b', ratioBps: 5000.5 },
        ],
      ),
    ).toBe(false);
    expect(
      validRecipeRatios(
        ['a', 'b'],
        [
          { ingredientId: 'a', ratioBps: 4999 },
          { ingredientId: 'b', ratioBps: 5000 },
        ],
      ),
    ).toBe(false);
  });
});
