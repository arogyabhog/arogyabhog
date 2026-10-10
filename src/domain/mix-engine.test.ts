import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  calculateMix,
  scaleRatiosToWeight,
  largestRemainder,
  roundHalfUp,
  ceilDiv,
  MixError,
  EngineBugError,
  formatRupees,
  type Ingredient,
  type StoreConfig,
  type MixRequest,
} from './mix-engine';

/* ================================================================== *
 * Fixtures — REAL data from the client's spreadsheet
 * Source: discovery/arogyabhog-main-sheet.xlsx, verified in FINDINGS.md
 * ================================================================== */

/**
 * Everyday Atta, exactly as the client's sheet defines it.
 * Nutrients are stored scaled by 100 (348.93 kcal -> 34893).
 * Rates are COST rates in paise/kg; sell is set equal to cost so that the
 * computed raw total can be compared directly against the sheet's ₹466.50.
 */
const EVERYDAY_ATTA: Ingredient[] = [
  { id: 'RM-001', name: 'Whole Wheat (Sharbati Gehu)', isBaseGrain: true,  maxPctBps: null, sellPaisePerKg: 3500,  costPaisePerKg: 3500,  nutrients: { enerc: 34000, protcnt: 1200, fibtg: 1150 } },
  { id: 'RM-004', name: 'Standard Desi Kala Chana',    isBaseGrain: false, maxPctBps: null, sellPaisePerKg: 8000,  costPaisePerKg: 8000,  nutrients: { enerc: 36000, protcnt: 2000, fibtg: 1700 } },
  { id: 'RM-002', name: 'Normal Jau',                  isBaseGrain: false, maxPctBps: null, sellPaisePerKg: 5000,  costPaisePerKg: 5000,  nutrients: { enerc: 35400, protcnt: 1200, fibtg: 1700 } },
  { id: 'RM-006', name: 'Soybean',                     isBaseGrain: false, maxPctBps: null, sellPaisePerKg: 12000, costPaisePerKg: 12000, nutrients: { enerc: 44600, protcnt: 3600, fibtg: 900 } },
  { id: 'RM-007', name: 'Jundhi (Jowar)',              isBaseGrain: false, maxPctBps: null, sellPaisePerKg: 10000, costPaisePerKg: 10000, nutrients: { enerc: 34900, protcnt: 1040, fibtg: 1000 } },
  { id: 'RM-008', name: 'Ragi',                        isBaseGrain: false, maxPctBps: null, sellPaisePerKg: 7000,  costPaisePerKg: 7000,  nutrients: { enerc: 32800, protcnt: 730,  fibtg: 1150 } },
  { id: 'RM-009', name: 'Bajra',                       isBaseGrain: false, maxPctBps: null, sellPaisePerKg: 4000,  costPaisePerKg: 4000,  nutrients: { enerc: 36100, protcnt: 1160, fibtg: 1130 } },
  { id: 'RM-010', name: 'Flaxseed (Alsi)',             isBaseGrain: false, maxPctBps: null, sellPaisePerKg: 15000, costPaisePerKg: 15000, nutrients: { enerc: 53400, protcnt: 1800, fibtg: 2700 } },
];

const EVERYDAY_WEIGHTS_10KG = [7500, 800, 500, 400, 300, 200, 200, 100];
const NUTRIENT_CODES = ['enerc', 'protcnt', 'fibtg'] as const;

const STORE: StoreConfig = {
  allowedPackSizesG: [5000, 10000, 15000, 20000],
  millingFeePaisePerKg: 400,
  packagingFeePaise: 500,
  deliveryFeePaise: 5000,
  gstRateBps: 500,
  minBaseGrainBps: 6000,
};

const catalogOf = (ings: readonly Ingredient[]) => new Map(ings.map((i) => [i.id, i]));

const everydayRequest = (targetWeightG = 10000): MixRequest => {
  const scale = targetWeightG / 10000;
  return {
    targetWeightG,
    packageCount: 1,
    items: EVERYDAY_ATTA.map((ing, i) => ({
      ingredientId: ing.id,
      weightG: EVERYDAY_WEIGHTS_10KG[i]! * scale,
    })),
  };
};

/* ================================================================== *
 * 1. GOLDEN REGRESSION — the engine must reproduce the client's sheet
 * ================================================================== */

describe('golden regression: Everyday Atta vs the client spreadsheet', () => {
  const result = calculateMix(everydayRequest(), catalogOf(EVERYDAY_ATTA), STORE, NUTRIENT_CODES);
  const byCode = Object.fromEntries(result.nutrition.per100g.map((n) => [n.code, n.valueScaled]));

  it('reproduces the sheet energy panel exactly (348.93 kcal)', () => {
    expect(byCode.enerc).toBe(34893); // 348.93 kcal
  });

  it('reproduces the sheet protein panel exactly (13.51 g)', () => {
    expect(byCode.protcnt).toBe(1351); // 13.51 g
  });

  it('reproduces the sheet fibre panel exactly (12.221 g -> 12.22)', () => {
    expect(byCode.fibtg).toBe(1222);
  });

  it('reproduces the sheet raw material cost exactly (₹466.50 per 10 kg)', () => {
    expect(result.pricing.rawPaise).toBe(46650);
    expect(formatRupees(result.pricing.rawPaise)).toBe('₹466.50');
  });

  it('applies milling ₹4/kg and packaging ₹5 FLAT (ADR-010, not the sheet\'s ₹5 x kg)', () => {
    expect(result.pricing.millingPaise).toBe(4000); // 10 kg x ₹4
    expect(result.pricing.packagingPaise).toBe(500); // ₹5 flat, NOT ₹50
    expect(result.pricing.subtotalPaise).toBe(51150); // ₹511.50 — the corrected true cost
  });

  it('splits GST 5% inclusive into exact CGST + SGST halves', () => {
    // 51150 x 500 / 10500 = 2435.71... -> 2436
    expect(result.pricing.gstPaise).toBe(2436);
    expect(result.pricing.cgstPaise + result.pricing.sgstPaise).toBe(result.pricing.gstPaise);
    expect(result.pricing.cgstPaise).toBe(1218);
    expect(result.pricing.sgstPaise).toBe(1218);
  });

  it('quotes delivery once at order level and excludes it from the line total', () => {
    expect(result.pricing.deliveryPaise).toBe(5000);
    expect(result.pricing.totalPaise).toBe(result.pricing.subtotalPaise);
  });

  it('reports base grain at exactly 75% for this recipe', () => {
    expect(result.baseGrainBps).toBe(7500);
  });
});

/* ================================================================== *
 * 2. THE VITALITY RULE (R1.3) — the client's real defect, as a test
 * ================================================================== */

describe('the Vitality Rule: missing data must hard-fail, never compute as zero', () => {
  /**
   * This is the actual defect found in the client's spreadsheet
   * (discovery/FINDINGS.md §1). The Vitality Atta tab reports 166.17 kcal when
   * the correct value is 349.74 kcal — a 52% understatement — because two
   * ingredients were absent from the lookup tables and their failed lookups
   * silently contributed zero while shrinking the denominator.
   *
   * The sheet produced a confident, plausible, wrong answer with no error.
   * This engine must make that outcome unreachable.
   */
  const VITALITY_RECIPE = [
    { id: 'RM-001', name: 'Whole Wheat (Sharbati Gehu)', isBaseGrain: true,  maxPctBps: null, sellPaisePerKg: 3500,  costPaisePerKg: 3500,  nutrients: { enerc: 34000, protcnt: 1200 } , w: 5000 },
    { id: 'RM-005', name: 'Premium Desi Kala Chana',     isBaseGrain: false, maxPctBps: null, sellPaisePerKg: 10000, costPaisePerKg: 10000, nutrients: { enerc: 36000, protcnt: 2100 } , w: 1500 },
    { id: 'RM-003', name: 'Premium Jau',                 isBaseGrain: false, maxPctBps: null, sellPaisePerKg: 7000,  costPaisePerKg: 7000,  nutrients: { enerc: 35400, protcnt: 1250 } , w: 1000 },
    { id: 'RM-008', name: 'Ragi',                        isBaseGrain: false, maxPctBps: null, sellPaisePerKg: 7000,  costPaisePerKg: 7000,  nutrients: { enerc: 32800, protcnt: 730 }  , w: 1000 },
    { id: 'RM-016', name: 'Pumpkin Seeds (Kaddu Beej)',  isBaseGrain: false, maxPctBps: null, sellPaisePerKg: 85000, costPaisePerKg: 85000, nutrients: { enerc: 55900, protcnt: 3020 } , w: 500 },
    // 🔴 White Sesame: priced, but ABSENT from the sheet's Nutrient Reference
    { id: 'RM-015', name: 'White Sesame Seeds (Til)',    isBaseGrain: false, maxPctBps: null, sellPaisePerKg: 25000, costPaisePerKg: 25000, nutrients: { enerc: undefined as unknown as number } , w: 300 },
    { id: 'RM-010', name: 'Flaxseed (Alsi)',             isBaseGrain: false, maxPctBps: null, sellPaisePerKg: 15000, costPaisePerKg: 15000, nutrients: { enerc: 53400, protcnt: 1800 } , w: 300 },
    { id: 'RM-017', name: 'Sunflower Seeds',             isBaseGrain: false, maxPctBps: null, sellPaisePerKg: 50000, costPaisePerKg: 50000, nutrients: { enerc: 58400, protcnt: 2080 } , w: 200 },
    // 🔴 Methi Seeds: in NO master table. Sheet records rate = ₹0.
    { id: 'METHI',  name: 'Methi Seeds (Fenugreek)',     isBaseGrain: false, maxPctBps: null, sellPaisePerKg: 0,     costPaisePerKg: 0,     nutrients: { enerc: 23490, protcnt: 2541 } , w: 100 },
    { id: 'RM-011', name: 'Psyllium Husk (Isabgol)',     isBaseGrain: false, maxPctBps: null, sellPaisePerKg: 15000, costPaisePerKg: 15000, nutrients: { enerc: 18900, protcnt: 0 }    , w: 100 },
  ];

  const build = () => {
    const ings: Ingredient[] = VITALITY_RECIPE.map(({ w: _w, ...rest }) => rest as Ingredient);
    const req: MixRequest = {
      targetWeightG: 10000,
      packageCount: 1,
      items: VITALITY_RECIPE.map((r) => ({ ingredientId: r.id, weightG: r.w })),
    };
    return { ings, req };
  };

  // Admin premade blends are exempt from the 60% floor (ADR-013) — wheat is 50% here.
  const ADMIN_STORE: StoreConfig = { ...STORE, minBaseGrainBps: 0 };

  it('fails fast on the first incomplete ingredient, naming a genuinely-incomplete one', () => {
    const { ings, req } = build();
    // Iteration order reaches White Sesame (missing nutrients) before Methi
    // (rate 0). Either is a valid fail-fast target; what matters is that the
    // engine refuses and names an ingredient that IS actually incomplete —
    // never a healthy one, never a silent zero.
    try {
      calculateMix(req, catalogOf(ings), ADMIN_STORE, ['enerc', 'protcnt']);
      throw new Error('expected MixError');
    } catch (e) {
      expect(e).toBeInstanceOf(MixError);
      expect((e as MixError).code).toBe('INCOMPLETE_INGREDIENT_DATA');
      expect(['White Sesame Seeds (Til)', 'Methi Seeds (Fenugreek)']).toContain(
        (e as MixError).details.name,
      );
    }
  });

  it('names a zero selling rate once nutrient data is complete', () => {
    const { ings, req } = build();
    const fixed = ings.map((i) =>
      i.id === 'RM-015' ? { ...i, nutrients: { enerc: 51960, protcnt: 2170 } } : i,
    );
    try {
      calculateMix(req, catalogOf(fixed), ADMIN_STORE, ['enerc', 'protcnt']);
      throw new Error('expected MixError');
    } catch (e) {
      expect((e as MixError).code).toBe('INCOMPLETE_INGREDIENT_DATA');
      expect((e as MixError).details).toMatchObject({
        name: 'Methi Seeds (Fenugreek)',
        field: 'sellPaisePerKg',
      });
    }
  });

  it('names the exact missing nutrients once rates are complete', () => {
    const { ings, req } = build();
    const fixed = ings.map((i) =>
      i.id === 'METHI' ? { ...i, sellPaisePerKg: 20000, costPaisePerKg: 15000 } : i,
    );
    try {
      calculateMix(req, catalogOf(fixed), ADMIN_STORE, ['enerc', 'protcnt']);
      throw new Error('expected MixError');
    } catch (e) {
      expect((e as MixError).code).toBe('INCOMPLETE_INGREDIENT_DATA');
      expect((e as MixError).details).toMatchObject({
        name: 'White Sesame Seeds (Til)',
        field: 'nutrients',
        missing: ['enerc', 'protcnt'],
      });
    }
  });

  it('never returns a result containing a silently-zeroed nutrient', () => {
    const { ings, req } = build();
    let threw = false;
    try {
      calculateMix(req, catalogOf(ings), ADMIN_STORE, ['enerc', 'protcnt']);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it('distinguishes a legitimate ZERO value from MISSING data', () => {
    // Psyllium Husk genuinely has 0 g protein. Zero is a real measurement and
    // must be accepted; only `undefined` is a data gap. Conflating them is what
    // broke the spreadsheet.
    const psyllium: Ingredient = {
      id: 'RM-011', name: 'Psyllium Husk (Isabgol)', isBaseGrain: false, maxPctBps: null,
      sellPaisePerKg: 15000, costPaisePerKg: 15000, nutrients: { enerc: 18900, protcnt: 0 },
    };
    const wheat: Ingredient = { ...EVERYDAY_ATTA[0]! };
    const req: MixRequest = {
      targetWeightG: 5000, packageCount: 1,
      items: [
        { ingredientId: wheat.id, weightG: 4000 },
        { ingredientId: psyllium.id, weightG: 1000 },
      ],
    };
    const r = calculateMix(req, catalogOf([wheat, psyllium]), ADMIN_STORE, ['enerc', 'protcnt']);
    const prot = r.nutrition.per100g.find((n) => n.code === 'protcnt')!;
    // 0.8 x 12.00 + 0.2 x 0.00 = 9.60 g
    expect(prot.valueScaled).toBe(960);
  });
});

/* ================================================================== *
 * 3. PROPERTY-BASED / ADVERSARIAL (fast-check)
 * ================================================================== */

const arbStore = (minBaseGrainBps = 0): fc.Arbitrary<StoreConfig> =>
  fc.record({
    allowedPackSizesG: fc.constant([5000, 10000, 15000, 20000] as readonly number[]),
    millingFeePaisePerKg: fc.integer({ min: 0, max: 5000 }),
    packagingFeePaise: fc.integer({ min: 0, max: 5000 }),
    deliveryFeePaise: fc.integer({ min: 0, max: 20000 }),
    gstRateBps: fc.integer({ min: 0, max: 4000 }),
    minBaseGrainBps: fc.constant(minBaseGrainBps),
  });

const arbIngredient = (id: string, isBaseGrain: boolean): fc.Arbitrary<Ingredient> =>
  fc.record({
    id: fc.constant(id),
    name: fc.constant(`ingredient-${id}`),
    isBaseGrain: fc.constant(isBaseGrain),
    maxPctBps: fc.constant(null),
    sellPaisePerKg: fc.integer({ min: 100, max: 200000 }),
    costPaisePerKg: fc.integer({ min: 100, max: 200000 }),
    // 0 is a legitimate measurement; `undefined` is the data gap. See R1.3.
    nutrients: fc.record({
      enerc: fc.integer({ min: 0, max: 100000 }),
      protcnt: fc.integer({ min: 0, max: 10000 }),
      fibtg: fc.integer({ min: 0, max: 10000 }),
      ca: fc.integer({ min: 0, max: 200000 }),
    }),
  });

/**
 * Generates a mix whose weights sum EXACTLY to the target, using independent
 * random cut-points (deliberately NOT `largestRemainder`, so the generator does
 * not depend on the code under test).
 */
const arbValidMix = () =>
  fc
    .integer({ min: 2, max: 8 })
    .chain((n) =>
      fc.constant([5000, 10000, 15000, 20000][Math.floor(n / 9)] ?? 10000).chain((target) =>
        fc
          .uniqueArray(fc.integer({ min: 1, max: target - 1 }), {
            minLength: n - 1,
            maxLength: n - 1,
          })
          .chain((cuts) => {
            const sorted = [...cuts].sort((a, b) => a - b);
            const weights: number[] = [];
            let prev = 0;
            for (const c of sorted) {
              weights.push(c - prev);
              prev = c;
            }
            weights.push(target - prev);
            const ings = fc.tuple(
              ...weights.map((_, i) => arbIngredient(`ING-${i}`, i === 0)),
            ) as unknown as fc.Arbitrary<Ingredient[]>;
            return ings.map((ingredients) => ({
              target,
              ingredients,
              weights,
            }));
          }),
      ),
    )
    .filter((m) => m.weights.every((w) => w > 0) && m.ingredients.length >= 2);

const runMix = (m: { target: number; ingredients: Ingredient[]; weights: number[] }, store?: StoreConfig) =>
  calculateMix(
    {
      targetWeightG: m.target,
      packageCount: 1,
      items: m.ingredients.map((ing, i) => ({ ingredientId: ing.id, weightG: m.weights[i]! })),
    },
    catalogOf(m.ingredients),
    store ?? { ...STORE, minBaseGrainBps: 0 },
    NUTRIENT_CODES,
  );

describe('property: mass and percentage closure', () => {
  it('R1.1 — ingredient weights always sum exactly to the target', () => {
    fc.assert(
      fc.property(arbValidMix(), (m) => {
        const r = runMix(m);
        const sum = r.composition.reduce((a, c) => a + c.weightG, 0);
        expect(sum).toBe(m.target);
      }),
      { numRuns: 500 },
    );
  });

  it('R1.2 — ratios always sum to exactly 10000 bps, never 9999 or 10001', () => {
    fc.assert(
      fc.property(arbValidMix(), (m) => {
        const r = runMix(m);
        expect(r.composition.reduce((a, c) => a + c.ratioBps, 0)).toBe(10000);
      }),
      { numRuns: 500 },
    );
  });

  it('every ratio is non-negative and no ratio exceeds 10000', () => {
    fc.assert(
      fc.property(arbValidMix(), (m) => {
        for (const c of runMix(m).composition) {
          expect(c.ratioBps).toBeGreaterThanOrEqual(0);
          expect(c.ratioBps).toBeLessThanOrEqual(10000);
        }
      }),
      { numRuns: 300 },
    );
  });
});

describe('property: pricing integrity', () => {
  it('invariant 10 — displayed line prices sum EXACTLY to the raw total', () => {
    fc.assert(
      fc.property(arbValidMix(), (m) => {
        const p = runMix(m).pricing;
        const lines = runMix(m).composition.reduce((a, c) => a + c.linePaise, 0);
        expect(lines).toBe(p.rawPaise);
      }),
      { numRuns: 500 },
    );
  });

  /**
   * Per-line display deviation bound. TWO integer-rounding stages exist and
   * both are unavoidable in integer paise: (a) the mix total is rounded to a
   * whole paisa (|raw - Σexact| ≤ 0.5), and (b) that integer total is allocated
   * across lines by largest remainder (|line - proportional share| < 1).
   * Combined worst case is therefore ~1.5 paise, so the honest bound is 2 —
   * an earlier "≤ 1" asserted a tighter bound than integer arithmetic can
   * guarantee and was falsified by the fuzzer. The HARD invariant is elsewhere:
   * Σ linePaise === rawPaise EXACTLY (tested above), so the customer never sees
   * lines that fail to add up. A ≤2 paise wobble on a ₹500 line is invisible.
   */
  it('each line price is within 2 paise of its exact rational share', () => {
    fc.assert(
      fc.property(arbValidMix(), (m) => {
        const r = runMix(m);
        r.composition.forEach((c) => {
          const exact = (c.weightG * c.sellRatePaisePerKg) / 1000;
          expect(Math.abs(c.linePaise - exact)).toBeLessThanOrEqual(2);
        });
      }),
      { numRuns: 300 },
    );
  });

  it('subtotal === raw + milling + packaging, always', () => {
    fc.assert(
      fc.property(arbValidMix(), arbStore(), (m, s) => {
        const p = runMix(m, s).pricing;
        expect(p.subtotalPaise).toBe(p.rawPaise + p.millingPaise + p.packagingPaise);
        expect(p.totalPaise).toBe(p.subtotalPaise); // GST-inclusive (ADR-009)
      }),
      { numRuns: 500 },
    );
  });

  it('CGST + SGST === GST exactly, and GST never exceeds the subtotal', () => {
    fc.assert(
      fc.property(arbValidMix(), arbStore(), (m, s) => {
        const p = runMix(m, s).pricing;
        expect(p.cgstPaise + p.sgstPaise).toBe(p.gstPaise);
        expect(p.gstPaise).toBeLessThanOrEqual(p.subtotalPaise);
        expect(p.cgstPaise).toBeGreaterThanOrEqual(0);
        expect(p.sgstPaise).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 500 },
    );
  });

  it('invariant 4 — raising any ingredient rate can never lower the mix price', () => {
    fc.assert(
      fc.property(arbValidMix(), fc.integer({ min: 1, max: 100000 }), fc.nat(7), (m, bump, idxSeed) => {
        const before = runMix(m).pricing.rawPaise;
        const idx = idxSeed % m.ingredients.length;
        const bumped = m.ingredients.map((ing, i) =>
          i === idx ? { ...ing, sellPaisePerKg: ing.sellPaisePerKg + bump } : ing,
        );
        const after = runMix(
          { ...m, ingredients: bumped },
        ).pricing.rawPaise;
        expect(after).toBeGreaterThanOrEqual(before);
      }),
      { numRuns: 400 },
    );
  });

  it('scaling the pack size scales the raw price proportionally within rounding', () => {
    fc.assert(
      fc.property(arbValidMix(), (m) => {
        if (m.target !== 5000) return; // only 5000 can double into an allowed size
        const single = runMix(m).pricing.rawPaise;
        const doubled = runMix({
          ...m,
          target: 10000,
          weights: m.weights.map((w) => w * 2),
        }).pricing.rawPaise;
        expect(Math.abs(doubled - single * 2)).toBeLessThanOrEqual(1);
      }),
      { numRuns: 200 },
    );
  });

  it('margin is 0 bps when sell rates equal cost rates', () => {
    fc.assert(
      fc.property(arbValidMix(), (m) => {
        const atCost = m.ingredients.map((i) => ({ ...i, sellPaisePerKg: i.costPaisePerKg }));
        const p = runMix({ ...m, ingredients: atCost }).pricing;
        expect(p.marginBps).toBe(0);
      }),
      { numRuns: 300 },
    );
  });
});

describe('property: nutrition maths', () => {
  it('invariant 8 — the engine is deterministic (same input, identical output)', () => {
    fc.assert(
      fc.property(arbValidMix(), (m) => {
        expect(runMix(m)).toStrictEqual(runMix(m));
      }),
      { numRuns: 300 },
    );
  });

  it('a single-value blend returns exactly that nutrient value (no drift)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 0, max: 10000 }),
        (enerc, protcnt) => {
          const ing: Ingredient = {
            id: 'X', name: 'X', isBaseGrain: true, maxPctBps: null,
            sellPaisePerKg: 5000, costPaisePerKg: 4000,
            nutrients: { enerc, protcnt, fibtg: 0, ca: 0 },
          };
          const ing2: Ingredient = { ...ing, id: 'Y', name: 'Y' };
          const r = calculateMix(
            { targetWeightG: 10000, packageCount: 1, items: [
              { ingredientId: 'X', weightG: 6000 }, { ingredientId: 'Y', weightG: 4000 } ] },
            catalogOf([ing, ing2]),
            { ...STORE, minBaseGrainBps: 0 },
            ['enerc', 'protcnt'],
          );
          expect(r.nutrition.per100g.find((n) => n.code === 'enerc')!.valueScaled).toBe(enerc);
          expect(r.nutrition.per100g.find((n) => n.code === 'protcnt')!.valueScaled).toBe(protcnt);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('the weighted mean is bounded by the min and max ingredient values', () => {
    fc.assert(
      fc.property(arbValidMix(), (m) => {
        const r = runMix(m);
        const got = r.nutrition.per100g.find((n) => n.code === 'enerc')!.valueScaled;
        const vals = m.ingredients.map((i) => i.nutrients.enerc!);
        expect(got).toBeGreaterThanOrEqual(Math.min(...vals) - 1);
        expect(got).toBeLessThanOrEqual(Math.max(...vals) + 1);
      }),
      { numRuns: 400 },
    );
  });
});

describe('property: constraint enforcement', () => {
  it('a mix below the base-grain floor is always rejected with the shortfall', () => {
    fc.assert(
      fc.property(arbValidMix(), (m) => {
        // Force every ingredient to be a NON-base grain -> 0% base grain.
        const noBase = m.ingredients.map((i) => ({ ...i, isBaseGrain: false }));
        try {
          runMix({ ...m, ingredients: noBase }, { ...STORE, minBaseGrainBps: 6000 });
          throw new Error('should have thrown');
        } catch (e) {
          expect(e).toBeInstanceOf(MixError);
          expect((e as MixError).code).toBe('BASE_GRAIN_BELOW_MINIMUM');
          expect((e as MixError).details).toMatchObject({ actualBps: 0, requiredBps: 6000 });
        }
      }),
      { numRuns: 200 },
    );
  });

  it('an ingredient over its cap is always rejected, naming the ingredient', () => {
    fc.assert(
      fc.property(arbValidMix(), (m) => {
        const capped = m.ingredients.map((i, idx) => ({ ...i, maxPctBps: idx === 0 ? 0 : 10000 }));
        // ingredient 0 can never exceed 0 bps, but it always has weight > 0
        try {
          runMix({ ...m, ingredients: capped }, { ...STORE, minBaseGrainBps: 0 });
          throw new Error('should have thrown');
        } catch (e) {
          expect(e).toBeInstanceOf(MixError);
          expect((e as MixError).code).toBe('INGREDIENT_OVER_CAP');
          expect((e as MixError).details).toMatchObject({ maxBps: 0 });
        }
      }),
      { numRuns: 200 },
    );
  });

  it('MASS_MISMATCH always reports a correctly-signed deltaG', () => {
    fc.assert(
      fc.property(arbValidMix(), fc.integer({ min: 1, max: 4000 }), (m, delta) => {
        const over = m.weights.map((w, i) => (i === 0 ? w + delta : w));
        try {
          runMix({ ...m, weights: over });
          throw new Error('should have thrown');
        } catch (e) {
          expect((e as MixError).code).toBe('MASS_MISMATCH');
          expect((e as MixError).details.deltaG).toBe(-delta); // must REMOVE
        }
        const under = m.weights.map((w, i) => (i === 0 ? Math.max(1, w - delta) : w));
        const actualShort = m.target - under.reduce((a, b) => a + b, 0);
        if (actualShort > 0) {
          try {
            runMix({ ...m, weights: under });
            throw new Error('should have thrown');
          } catch (e) {
            expect((e as MixError).code).toBe('MASS_MISMATCH');
            expect((e as MixError).details.deltaG).toBe(actualShort); // must ADD
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it('rejects a target weight that is not an allowed pack size', () => {
    fc.assert(
      fc.property(arbValidMix(), (m) => {
        const bad = { ...m, target: 7777, weights: m.weights.map((w, i) => (i === 0 ? w + (7777 - m.target) : w)) };
        if (bad.weights[0]! <= 0) return;
        try {
          runMix(bad);
          throw new Error('should have thrown');
        } catch (e) {
          expect((e as MixError).code).toBe('INVALID_PACK_SIZE');
        }
      }),
      { numRuns: 150 },
    );
  });
});

/* ================================================================== *
 * 4. ADVERSARIAL INPUTS — the things a real attacker or a tired admin does
 * ================================================================== */

describe('adversarial: malformed and hostile input', () => {
  const ing = EVERYDAY_ATTA.slice(0, 2);

  it.each([
    ['empty items', { targetWeightG: 10000, packageCount: 1, items: [] }],
    ['single item (below MIN_ITEMS)', { targetWeightG: 10000, packageCount: 1, items: [{ ingredientId: 'RM-001', weightG: 10000 }] }],
    ['zero weight', { targetWeightG: 10000, packageCount: 1, items: [{ ingredientId: 'RM-001', weightG: 0 }, { ingredientId: 'RM-004', weightG: 10000 }] }],
    ['negative weight', { targetWeightG: 10000, packageCount: 1, items: [{ ingredientId: 'RM-001', weightG: -500 }, { ingredientId: 'RM-004', weightG: 10500 }] }],
    ['fractional weight', { targetWeightG: 10000, packageCount: 1, items: [{ ingredientId: 'RM-001', weightG: 100.5 }, { ingredientId: 'RM-004', weightG: 9899.5 }] }],
    ['NaN weight', { targetWeightG: 10000, packageCount: 1, items: [{ ingredientId: 'RM-001', weightG: NaN }, { ingredientId: 'RM-004', weightG: 10000 }] }],
    ['zero packageCount', { targetWeightG: 10000, packageCount: 0, items: [{ ingredientId: 'RM-001', weightG: 6000 }, { ingredientId: 'RM-004', weightG: 4000 }] }],
    ['duplicate ingredient', { targetWeightG: 10000, packageCount: 1, items: [{ ingredientId: 'RM-001', weightG: 5000 }, { ingredientId: 'RM-001', weightG: 5000 }] }],
    ['unknown ingredient', { targetWeightG: 10000, packageCount: 1, items: [{ ingredientId: 'RM-001', weightG: 5000 }, { ingredientId: 'HACKED', weightG: 5000 }] }],
  ])('rejects %s', (_label, req) => {
    expect(() => calculateMix(req as MixRequest, catalogOf(ing), STORE, NUTRIENT_CODES)).toThrowError(MixError);
  });

  it('rejects prototype-pollution style ingredient ids', () => {
    for (const evil of ['__proto__', 'constructor', 'prototype', 'toString']) {
      expect(() =>
        calculateMix(
          { targetWeightG: 10000, packageCount: 1, items: [
            { ingredientId: evil, weightG: 6000 }, { ingredientId: 'RM-004', weightG: 4000 } ] },
          catalogOf(ing), STORE, NUTRIENT_CODES,
        ),
      ).toThrowError(MixError);
    }
  });

  it('rejects a hostile store config rather than producing nonsense', () => {
    const bad: Partial<StoreConfig>[] = [
      { allowedPackSizesG: [] },
      { gstRateBps: -1 },
      { gstRateBps: 999999 },
      { minBaseGrainBps: -5 },
      { millingFeePaisePerKg: -10 },
      { packagingFeePaise: 1.5 },
    ];
    for (const patch of bad) {
      expect(() =>
        calculateMix(everydayRequest(), catalogOf(EVERYDAY_ATTA), { ...STORE, ...patch }, NUTRIENT_CODES),
      ).toThrowError(MixError);
    }
  });

  it('never throws the internal EngineBugError on any adversarial request', () => {
    fc.assert(
      fc.property(
        fc.record({
          targetWeightG: fc.oneof(fc.integer(), fc.constant(NaN), fc.constant(Infinity)),
          packageCount: fc.oneof(fc.integer(), fc.constant(NaN)),
          items: fc.array(
            fc.record({ ingredientId: fc.string(), weightG: fc.oneof(fc.integer(), fc.double({ noNaN: false })) }),
            { maxLength: 14 },
          ),
        }),
        (req) => {
          try {
            calculateMix(req as unknown as MixRequest, catalogOf(EVERYDAY_ATTA), STORE, NUTRIENT_CODES);
          } catch (e) {
            // A MixError is a correct, typed rejection. An EngineBugError means
            // the engine's own invariants broke — that must never happen.
            expect(e).toBeInstanceOf(MixError);
            expect(e).not.toBeInstanceOf(EngineBugError);
          }
        },
      ),
      { numRuns: 2000 },
    );
  });
});

/* ================================================================== *
 * 5. PRIMITIVES
 * ================================================================== */

describe('largestRemainder', () => {
  it('always sums exactly to the total', () => {
    fc.assert(
      fc.property(
        fc.array(fc.bigInt({ min: 0n, max: 10n ** 9n }), { minLength: 1, maxLength: 30 }),
        fc.bigInt({ min: 0n, max: 10n ** 7n }),
        (values, total) => {
          if (values.every((v) => v === 0n)) return;
          const out = largestRemainder(values, total);
          expect(out.reduce((a, b) => a + b, 0n)).toBe(total);
          expect(out.every((v) => v >= 0n)).toBe(true);
        },
      ),
      { numRuns: 2000 },
    );
  });

  it('is deterministic regardless of sort stability', () => {
    fc.assert(
      fc.property(
        fc.array(fc.bigInt({ min: 1n, max: 1000n }), { minLength: 2, maxLength: 20 }),
        fc.bigInt({ min: 1n, max: 100000n }),
        (values, total) => {
          expect(largestRemainder(values, total)).toStrictEqual(largestRemainder(values, total));
        },
      ),
      { numRuns: 500 },
    );
  });

  it('throws on all-zero weights and on negative totals', () => {
    expect(() => largestRemainder([0n, 0n], 100n)).toThrowError(EngineBugError);
    expect(() => largestRemainder([1n], -1n)).toThrowError(EngineBugError);
    expect(() => largestRemainder([], 100n)).toThrowError(EngineBugError);
  });
});

describe('roundHalfUp / ceilDiv', () => {
  it('rounds .5 upward and matches exact rationals', () => {
    expect(roundHalfUp(1n, 2n)).toBe(1n); // 0.5 -> 1
    expect(roundHalfUp(3n, 2n)).toBe(2n); // 1.5 -> 2
    expect(roundHalfUp(5n, 2n)).toBe(3n); // 2.5 -> 3
    expect(roundHalfUp(-1n, 2n)).toBe(0n); // -0.5 -> 0 (toward +inf)
    expect(roundHalfUp(7n, 3n)).toBe(2n); // 2.333 -> 2
    expect(roundHalfUp(8n, 3n)).toBe(3n); // 2.666 -> 3
  });

  it('roundHalfUp never deviates from the exact rational by more than a half', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -(10n ** 12n), max: 10n ** 12n }),
        fc.bigInt({ min: 1n, max: 10n ** 6n }),
        (n, d) => {
          const r = roundHalfUp(n, d);
          const err = Number(r) - Number(n) / Number(d);
          expect(Math.abs(err)).toBeLessThanOrEqual(0.5 + 1e-9);
        },
      ),
      { numRuns: 2000 },
    );
  });

  it('ceilDiv is correct for negative operands too', () => {
    expect(ceilDiv(7n, 2n)).toBe(4n);
    expect(ceilDiv(-7n, 2n)).toBe(-3n);
    expect(ceilDiv(8n, 2n)).toBe(4n);
    expect(() => ceilDiv(1n, 0n)).toThrowError(EngineBugError);
  });
});

describe('scaleRatiosToWeight', () => {
  it('produces grams that sum exactly to the target, or refuses cleanly', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 10000 }), { minLength: 2, maxLength: 12 }),
        fc.constantFrom(5000, 10000, 15000, 20000),
        (ratios, target) => {
          const ids = ratios.map((_, i) => `I-${i}`);
          if (new Set(ids).size !== ids.length) return;
          try {
            const out = scaleRatiosToWeight(
              ratios.map((r, i) => ({ ingredientId: ids[i]!, ratio: r })),
              target,
            );
            expect(out.reduce((a, o) => a + o.weightG, 0)).toBe(target);
            expect(out.every((o) => o.weightG > 0)).toBe(true);
          } catch (e) {
            // The only acceptable refusal is the too-small-to-mill case.
            expect(e).toBeInstanceOf(MixError);
            expect((e as MixError).code).toBe('INGREDIENT_TOO_SMALL');
          }
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('is idempotent whenever it succeeds: re-scaling its own output yields the same grams', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 10000 }), { minLength: 2, maxLength: 10 }),
        (ratios) => {
          const target = 10000;
          let first;
          try {
            first = scaleRatiosToWeight(
              ratios.map((r, i) => ({ ingredientId: `I-${i}`, ratio: r })),
              target,
            );
          } catch {
            fc.pre(false); // legitimately un-millable input: not a counterexample
            return;
          }
          const second = scaleRatiosToWeight(
            first.map((f) => ({ ingredientId: f.ingredientId, ratio: f.weightG })),
            target,
          );
          expect(second).toStrictEqual(first);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('rejects duplicates, non-integers and empty input', () => {
    expect(() => scaleRatiosToWeight([], 10000)).toThrowError(MixError);
    expect(() =>
      scaleRatiosToWeight([{ ingredientId: 'A', ratio: 1 }, { ingredientId: 'A', ratio: 1 }], 10000),
    ).toThrowError(MixError);
    expect(() =>
      scaleRatiosToWeight([{ ingredientId: 'A', ratio: 1.5 }, { ingredientId: 'B', ratio: 1 }], 10000),
    ).toThrowError(MixError);
    expect(() =>
      scaleRatiosToWeight([{ ingredientId: 'A', ratio: 1 }, { ingredientId: 'B', ratio: 1 }], 0),
    ).toThrowError(MixError);
  });

  /**
   * FUZZER REGRESSION — fast-check seed 1187268016, path 55:2:0:6:8:10:8:8:8:0:12:11:3.
   * Ratio 1 out of 16957 used to scale to 0 g, which the weight validator then
   * rejected, crashing an otherwise legitimate customer ratio. Pinned so the
   * exact counterexample can never regress.
   */
  it('refuses a ratio too small to mill at the chosen pack size (fuzzer regression)', () => {
    // fast-check seed 1187268016: ratio 1 out of 16957 would scale to ~0.6 g at
    // 10 kg. Physically un-millable. We refuse with an actionable error instead
    // of silently bumping to 1 g (which would break idempotency and alter the
    // customer's recipe without telling them).
    expect(() =>
      scaleRatiosToWeight(
        [
          { ingredientId: 'A', ratio: 4446 },
          { ingredientId: 'B', ratio: 1 },
          { ingredientId: 'C', ratio: 8405 },
          { ingredientId: 'D', ratio: 4105 },
        ],
        10000,
      ),
    ).toThrowError(MixError);
    try {
      scaleRatiosToWeight(
        [
          { ingredientId: 'A', ratio: 4446 },
          { ingredientId: 'B', ratio: 1 },
          { ingredientId: 'C', ratio: 8405 },
          { ingredientId: 'D', ratio: 4105 },
        ],
        10000,
      );
    } catch (e) {
      expect((e as MixError).code).toBe('INGREDIENT_TOO_SMALL');
      expect((e as MixError).details).toMatchObject({ ingredientId: 'B' });
    }
  });

  it('rejects a target weight smaller than the ingredient count', () => {
    expect(() =>
      scaleRatiosToWeight(
        [
          { ingredientId: 'A', ratio: 1 },
          { ingredientId: 'B', ratio: 1 },
          { ingredientId: 'C', ratio: 1 },
        ],
        2,
      ),
    ).toThrowError(MixError);
  });
});

describe('formatRupees', () => {
  it('formats paise with Indian digit grouping', () => {
    expect(formatRupees(46650)).toBe('₹466.50');
    expect(formatRupees(165000)).toBe('₹1,650.00');
    expect(formatRupees(12345678)).toBe('₹1,23,456.78');
    expect(formatRupees(0)).toBe('₹0.00');
    expect(formatRupees(-500)).toBe('-₹5.00');
    expect(() => formatRupees(1.5)).toThrowError(EngineBugError);
  });
});
