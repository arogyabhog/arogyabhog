import { describe, expect, it } from 'vitest';
import { blendNutrition, formatAmount } from './nutrition-blend';

describe('blendNutrition', () => {
  it('weights by bps: 70/30 blend lands exactly between the two profiles', () => {
    const rows = blendNutrition(
      [
        { bps: 7000, values: { enerc: 300, protcnt: 10 } },
        { bps: 3000, values: { enerc: 600, protcnt: 20, zn: 5000 } },
      ],
      10000,
    );
    const by = Object.fromEntries(rows.map((r) => [r.code, r]));
    expect(by.enerc?.per100g).toBe(390); // 0.7×300 + 0.3×600
    expect(by.protcnt?.per100g).toBe(13); // 0.7×10 + 0.3×20
    expect(by.zn?.per100g).toBe(1500); // only the 30% ingredient has zinc
    expect(by.enerc?.coverageBps).toBe(10000);
    expect(by.zn?.coverageBps).toBe(3000); // …and says so
  });

  it('scales per-pack amounts with pack weight (10 kg pack = ×100 of per-100 g)', () => {
    const rows = blendNutrition([{ bps: 10000, values: { enerc: 350, fe: 4.2 } }], 10000);
    const by = Object.fromEntries(rows.map((r) => [r.code, r]));
    expect(by.enerc?.perPack).toBe(35000); // kcal in the whole 10 kg pack
    expect(by.fe?.perPack).toBe(420); // mg
    const five = blendNutrition([{ bps: 10000, values: { enerc: 350 } }], 5000);
    expect(five[0]?.perPack).toBe(17500);
  });

  it('keeps 2-dp integer discipline on fractional inputs', () => {
    const rows = blendNutrition(
      [
        { bps: 8500, values: { protcnt: 12.6 } }, // buckwheat-ish fractions
        { bps: 1500, values: { protcnt: 16.5 } },
      ],
      10000,
    );
    // 0.85×12.6 + 0.15×16.5 = 10.71 + 2.475 = 13.185 → 13.19 (half-up on ×100 grid)
    expect(rows[0]?.per100g).toBe(13.19);
  });

  it('ignores unknown nutrient codes and rows with zero coverage', () => {
    const rows = blendNutrition([{ bps: 10000, values: { mystery: 5, enerc: 100 } }], 10000);
    expect(rows.map((r) => r.code)).toEqual(['enerc']);
  });

  it('refuses nonsense pack weights and bps', () => {
    expect(() => blendNutrition([], 0)).toThrow();
    expect(() => blendNutrition([], -5)).toThrow();
    expect(() => blendNutrition([{ bps: -1, values: {} }], 1000)).toThrow();
  });

  it('groups and orders rows: macronutrients → minerals → vitamins', () => {
    const rows = blendNutrition(
      [{ bps: 10000, values: { zn: 100, enerc: 100, thia: 100, ca: 100, protcnt: 10 } }],
      10000,
    );
    expect(rows.map((r) => r.group)).toEqual(['macronutrients', 'macronutrients', 'minerals', 'minerals', 'vitamins']);
    expect(rows.map((r) => r.code).slice(0, 2)).toEqual(['enerc', 'protcnt']);
  });
});

describe('formatAmount', () => {
  it('auto-scales units for pack-sized totals', () => {
    expect(formatAmount(150000, 'µg')).toBe('150 mg'); // zinc per 10 kg pack
    expect(formatAmount(4600, 'mg')).toBe('4.6 g'); // calcium per pack
    expect(formatAmount(35000, 'kcal')).toBe('35000 kcal');
    expect(formatAmount(1200, 'g')).toBe('1.2 kg'); // carbs per pack
  });

  it('keeps small per-100 g values readable', () => {
    expect(formatAmount(12.6, 'g')).toBe('12.6 g');
    expect(formatAmount(4.2, 'mg')).toBe('4.2 mg');
    expect(formatAmount(0.35, 'mg')).toBe('0.35 mg');
    expect(formatAmount(390, 'kcal')).toBe('390 kcal');
  });
});
