import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { allocateIngredientGrams } from './inventory';

describe('integer ingredient inventory allocation', () => {
  it('allocates every gram and is deterministic when shares divide unevenly', () => {
    const recipe = [
      { ingredientId: 'RM-001', ratioBps: 3333 },
      { ingredientId: 'RM-002', ratioBps: 3333 },
      { ingredientId: 'RM-003', ratioBps: 3334 },
    ];
    const allocated = allocateIngredientGrams(5, recipe);
    expect(allocated).toEqual([
      { ingredientId: 'RM-001', grams: 2 },
      { ingredientId: 'RM-002', grams: 1 },
      { ingredientId: 'RM-003', grams: 2 },
    ]);
    expect(allocated.reduce((sum, line) => sum + line.grams, 0)).toBe(5);
  });

  it('is invariant for random valid two-item recipes and pack weights', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000 }), fc.integer({ min: 1, max: 9999 }), (weight, firstShare) => {
        const result = allocateIngredientGrams(weight, [
          { ingredientId: 'a', ratioBps: firstShare },
          { ingredientId: 'b', ratioBps: 10000 - firstShare },
        ]);
        expect(result.reduce((sum, line) => sum + line.grams, 0)).toBe(weight);
        expect(result.every((line) => Number.isSafeInteger(line.grams) && line.grams >= 0)).toBe(true);
      }),
      { numRuns: 1000 },
    );
  });

  it.each([
    [0, [{ ingredientId: 'a', ratioBps: 10000 }]],
    [10, []],
    [10, [{ ingredientId: 'a', ratioBps: 9999 }]],
    [
      10,
      [
        { ingredientId: 'a', ratioBps: 5000 },
        { ingredientId: 'a', ratioBps: 5000 },
      ],
    ],
  ] as const)('rejects invalid weight or recipe (%s)', (weight, recipe) => {
    expect(() => allocateIngredientGrams(weight, recipe)).toThrow();
  });
});
