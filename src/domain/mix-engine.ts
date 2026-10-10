/**
 * ArogyaBhog — Custom Blend ("Lab") Calculation Engine
 * ====================================================
 *
 * THE core of this product. Everything else in the application is CRUD; this is
 * the part that must be provably correct, because a silent error here either
 * loses the client money or misinforms a customer about what they are eating.
 *
 * Design rules (see .project-os/00_SYSTEM_RULES.md):
 *
 *  R1   Money is INTEGER PAISE. Weight is INTEGER GRAMS. Ratios are INTEGER
 *       BASIS POINTS (60% = 6000). There is not a single `float` in the money or
 *       mass path. Accumulation uses BigInt so overflow is not a reasoning burden.
 *
 *  R1.1 Mass conservation: Σ(ingredient grams) === target grams, exactly.
 *  R1.2 Percentage closure: Σ(ratio bps) === 10000, exactly.
 *
 *  R1.3 THE VITALITY RULE. A missing ingredient price or nutrient value is a
 *       HARD FAILURE, never a zero. This is named after a verified defect in the
 *       client's own spreadsheet, where two ingredients were absent from the
 *       lookup tables and the resulting nutrition panel silently reported
 *       166 kcal instead of the correct 350 kcal — a confident, plausible,
 *       wrong answer with no error raised. That failure mode must be impossible
 *       here, by construction, not by code review.
 *
 * This module is PURE: no I/O, no clock, no randomness, no DB, no globals.
 * Same input always produces byte-identical output (enables snapshot testing).
 */

export const ENGINE_VERSION = '1.0.0';

/* ------------------------------------------------------------------ *
 * Integer arithmetic primitives
 * ------------------------------------------------------------------ */

/** Floor division that is correct for negative operands (BigInt `/` truncates). */
function floorDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new EngineBugError('floorDiv: division by zero');
  const q = a / b;
  return a % b !== 0n && a < 0n !== b < 0n ? q - 1n : q;
}

/** Round half up (toward +∞ on the .5 boundary). Exact, no floating point. */
export function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new EngineBugError('roundHalfUp: division by zero');
  const n = denominator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  return floorDiv(2n * n + d, 2n * d);
}

/** Ceil division, correct for all signs. */
export function ceilDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new EngineBugError('ceilDiv: division by zero');
  return -floorDiv(-a, b);
}

/**
 * Allocate `total` indivisible units across `values` proportionally, using the
 * largest-remainder method. Guarantees:
 *
 *   1. Σ(result) === total            — exactly, never off by one
 *   2. each result is within 1 unit of its exact rational share
 *   3. deterministic — ties break by ascending index, never by sort instability
 *
 * This single helper is what makes R1.1, R1.2 and pricing invariant 10
 * ("the sum of the displayed line prices equals the displayed total") true by
 * construction rather than by luck. Naively rounding each share independently is
 * the bug this exists to prevent; it produces totals that are one paise or one
 * gram away from the sum of their parts, which is visible on an invoice.
 */
export function largestRemainder(values: readonly bigint[], total: bigint): bigint[] {
  const n = values.length;
  if (n === 0) throw new EngineBugError('largestRemainder: empty input');
  if (total < 0n) throw new EngineBugError('largestRemainder: negative total');
  if (values.some((v) => v < 0n)) throw new EngineBugError('largestRemainder: negative weight');

  const sum = values.reduce((a, b) => a + b, 0n);
  if (sum === 0n) throw new EngineBugError('largestRemainder: all weights zero');

  // All operands are non-negative here, so BigInt `/` is already floor.
  const quotas = values.map((v) => (v * total) / sum);
  const remainders = values.map((v) => (v * total) % sum);

  const distributed = quotas.reduce((a, b) => a + b, 0n);
  const shortfall = Number(total - distributed); // provably in [0, n)

  const order = values
    .map((_, i) => i)
    .sort((a, b) => {
      const d = (remainders[b] ?? 0n) - (remainders[a] ?? 0n); // descending by remainder
      if (d !== 0n) return d > 0n ? 1 : -1;
      return a - b; // deterministic tie-break
    });

  const out = quotas.slice();
  for (let k = 0; k < shortfall; k++) {
    const idx = order[k];
    if (idx === undefined) throw new EngineBugError('largestRemainder: order index out of range');
    out[idx] = (out[idx] ?? 0n) + 1n;
  }
  return out;
}

/**
 * Proportional allocation that guarantees EVERY part receives at least 1 unit,
 * WITHOUT disturbing parts that were already allocated exactly.
 *
 * Plain `largestRemainder` can legally return 0 for a very small share (e.g. a
 * 1 g ingredient in a 20 kg mix rounds to 0 bps). A zeroed ingredient would then
 * silently contribute nothing to nutrition, base-grain floor or caps — the same
 * silent-zero failure class as R1.3, just smaller.
 *
 * A naive "allocate total-n then add 1 to each" fixes the zeros but biases
 * EVERY part, breaking exactness for inputs that needed no help at all (the
 * golden Everyday-Atta case allocates exactly and must stay exact).
 *
 * So: run the plain allocation, then lift each zero by taking exactly 1 unit
 * from the current largest part (donor must stay ≥ 1). Σ is preserved, exact
 * inputs are untouched, and the perturbation is at most 1 unit per lifted part.
 * Feasibility: with k non-zero parts holding `total` units, `total - k` units
 * are spare, and zeros z = n - k ≤ total - k whenever n ≤ total. Guaranteed
 * here (10000 bps ≥ item count).
 */
export function largestRemainderAtLeastOne(values: readonly bigint[], total: bigint): bigint[] {
  const out = largestRemainder(values, total);
  const n = out.length;
  if (BigInt(n) > total) {
    throw new EngineBugError(`largestRemainderAtLeastOne: total ${total} < parts ${n}`);
  }
  let lifted = 0;
  for (;;) {
    const zeroIdx = out.indexOf(0n);
    if (zeroIdx === -1) break;
    let donor = -1;
    let best = 1n; // donor must hold > 1 so it stays ≥ 1 after giving
    out.forEach((v, i) => {
      if (v > best) {
        best = v;
        donor = i;
      }
    });
    if (donor === -1) throw new EngineBugError('largestRemainderAtLeastOne: no donor available');
    out[donor] = (out[donor] ?? 0n) - 1n;
    out[zeroIdx] = 1n;
    if (++lifted > n) throw new EngineBugError('largestRemainderAtLeastOne: no progress');
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Errors
 * ------------------------------------------------------------------ */

export type MixErrorCode =
  | 'EMPTY_MIX'
  | 'TOO_MANY_ITEMS'
  | 'DUPLICATE_INGREDIENT'
  | 'INVALID_WEIGHT'
  | 'INVALID_TARGET_WEIGHT'
  | 'INVALID_PACKAGE_COUNT'
  | 'INVALID_CONFIG'
  | 'INGREDIENT_UNKNOWN'
  | 'INCOMPLETE_INGREDIENT_DATA' // <-- the Vitality Rule
  | 'MASS_MISMATCH'
  | 'INVALID_PACK_SIZE'
  | 'INGREDIENT_TOO_SMALL'
  | 'BASE_GRAIN_BELOW_MINIMUM'
  | 'INGREDIENT_OVER_CAP'
  | 'STORE_NOT_FOUND';

/**
 * A domain rejection. Always carries a machine-readable `code` and enough
 * structured detail for the UI to tell the customer precisely how to fix it
 * ("remove 250 g", "add 400 g", "wheat must be at least 60%").
 *
 * Never a bare 500, never a silent default (see 06_API_CONTRACTS.md §5).
 */
export class MixError extends Error {
  constructor(
    readonly code: MixErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'MixError';
  }
}

/** Signals a bug in the engine itself, not bad user input. Must never be reachable. */
export class EngineBugError extends Error {
  constructor(message: string) {
    super(`ENGINE BUG: ${message}`);
    this.name = 'EngineBugError';
  }
}

/* ------------------------------------------------------------------ *
 * Domain types
 * ------------------------------------------------------------------ */

export type NutrientSource = 'IFCT2017' | 'USDA' | 'CLIENT' | 'LAB';

export interface Ingredient {
  id: string;
  name: string;
  /** Counts toward the store's minimum-base-grain floor (ADR-013). */
  isBaseGrain: boolean;
  /** Per-ingredient maximum share in bps. `null` = uncapped. */
  maxPctBps: number | null;
  /**
   * SELLING rate — drives custom-mix pricing and IS shown to the customer in the
   * price breakdown (ADR-008, client decision C3).
   */
  sellPaisePerKg: number;
  /** COST rate — admin/manager-only, drives margin reporting. Never customer-facing. */
  costPaisePerKg: number;
  /**
   * Per-100 g values as integers scaled by 100 (i.e. 348.93 kcal is stored as
   * 34893). Integer storage keeps the weighted average exact; see R1.
   *
   * MUST contain an entry for every code in `nutrientCodes` passed to
   * `calculateMix`, or the engine hard-fails with INCOMPLETE_INGREDIENT_DATA.
   */
  nutrients: Record<string, number>;
  /** Provenance per nutrient (ADR-007). One source per nutrient, never two. */
  nutrientSources?: Record<string, NutrientSource>;
}

export interface StoreConfig {
  /** Valid total weights for a custom mix, in grams. Mixes allow 5 kg (ADR-021). */
  allowedPackSizesG: readonly number[];
  millingFeePaisePerKg: number;
  packagingFeePaise: number;
  /** Quoted here for display; applied ONCE at order level, never per line (ADR-010). */
  deliveryFeePaise: number;
  /** GST rate in bps. 5% = 500. Displayed prices are GST-INCLUSIVE (ADR-009). */
  gstRateBps: number;
  /** Minimum share of base grain for a customer-created mix. 60% = 6000 (ADR-013). */
  minBaseGrainBps: number;
}

export interface MixRequest {
  targetWeightG: number;
  packageCount: number;
  items: ReadonlyArray<{ ingredientId: string; weightG: number }>;
}

export interface CompositionLine {
  ingredientId: string;
  name: string;
  weightG: number;
  ratioBps: number;
  /** Formatted for display, e.g. "60.0%". */
  displayPercent: string;
  isBaseGrain: boolean;
  sellRatePaisePerKg: number;
  /** Displayed line price. Σ of these === pricing.rawPaise, exactly. */
  linePaise: number;
}

export interface NutrientResult {
  code: string;
  /** Per 100 g, scaled by 100 (34893 = 348.93). */
  valueScaled: number;
  sources: NutrientSource[];
}

export interface MixPricing {
  /** Σ ingredient cost at selling rates. */
  rawPaise: number;
  millingPaise: number;
  packagingPaise: number;
  /** raw + milling + packaging. GST-INCLUSIVE (ADR-009). */
  subtotalPaise: number;
  gstRateBps: number;
  /** The GST component contained within subtotalPaise. */
  gstPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  /** Quoted, not included — applied once per order (ADR-010). */
  deliveryPaise: number;
  /** What the customer pays for this line, excluding order-level delivery. */
  totalPaise: number;
  /** Cost at admin cost-rates, for margin reporting. Never customer-facing. */
  internalCostPaise: number;
  marginBps: number;
  currency: 'INR';
}

export interface MixResult {
  engineVersion: string;
  targetWeightG: number;
  packageCount: number;
  baseGrainBps: number;
  composition: CompositionLine[];
  nutrition: {
    per100g: NutrientResult[];
    /** True always — these are computed from published tables, never lab-analysed (R9). */
    estimated: boolean;
    sources: NutrientSource[];
  };
  pricing: MixPricing;
}

/* ------------------------------------------------------------------ *
 * Validation constants
 * ------------------------------------------------------------------ */

const MAX_ITEMS = 12;
const MIN_ITEMS = 2;
const BPS_TOTAL = 10000n;
const GRAMS_PER_KG = 1000n;

/* ------------------------------------------------------------------ *
 * The engine
 * ------------------------------------------------------------------ */

/**
 * Compute a custom blend's composition, nutrition and price.
 *
 * @param req            the customer's requested mix
 * @param catalog        resolvable ingredients for this store
 * @param store          store-level fee and rule configuration
 * @param nutrientCodes  the full nutrient set the catalog is expected to carry.
 *                       Every ingredient must supply every one of these, or the
 *                       call fails with INCOMPLETE_INGREDIENT_DATA (R1.3).
 * @throws {MixError}    with a typed code and actionable details
 */
export function calculateMix(
  req: MixRequest,
  catalog: ReadonlyMap<string, Ingredient>,
  store: StoreConfig,
  nutrientCodes: readonly string[],
): MixResult {
  assertStoreConfig(store);
  assertRequest(req);

  /* ---- 1. Resolve ingredients; fail hard on anything incomplete (R1.3) ---- */
  const seen = new Set<string>();
  const resolved: Array<{ ing: Ingredient; weightG: bigint }> = [];

  for (const item of req.items) {
    if (seen.has(item.ingredientId)) {
      throw new MixError('DUPLICATE_INGREDIENT', `Ingredient ${item.ingredientId} appears twice`, {
        ingredientId: item.ingredientId,
      });
    }
    seen.add(item.ingredientId);

    const ing = catalog.get(item.ingredientId);
    if (!ing) {
      throw new MixError('INGREDIENT_UNKNOWN', `Unknown ingredient: ${item.ingredientId}`, {
        ingredientId: item.ingredientId,
      });
    }
    assertIngredientComplete(ing, nutrientCodes);
    resolved.push({ ing, weightG: BigInt(item.weightG) });
  }

  /* ---- 2. Mass conservation (R1.1) ---- */
  const totalG = resolved.reduce((a, r) => a + r.weightG, 0n);
  const targetG = BigInt(req.targetWeightG);
  if (totalG !== targetG) {
    const deltaG = Number(targetG - totalG);
    throw new MixError(
      'MASS_MISMATCH',
      deltaG > 0
        ? `Add ${deltaG} g more ingredients to reach ${req.targetWeightG} g`
        : `Remove ${-deltaG} g to reach ${req.targetWeightG} g`,
      { totalG: Number(totalG), targetWeightG: req.targetWeightG, deltaG },
    );
  }

  /* ---- 3. Pack size ---- */
  if (!store.allowedPackSizesG.includes(req.targetWeightG)) {
    throw new MixError('INVALID_PACK_SIZE', `${req.targetWeightG} g is not an allowed pack size`, {
      targetWeightG: req.targetWeightG,
      allowed: [...store.allowedPackSizesG],
    });
  }

  /* ---- 4. Ratios in bps — Σ === 10000 exactly, every line ≥ 1 bps (R1.2) ---- */
  const ratioBps = largestRemainderAtLeastOne(
    resolved.map((r) => r.weightG),
    BPS_TOTAL,
  );
  assertSum(ratioBps, BPS_TOTAL, 'percentage closure (R1.2)');

  /* ---- 5. Base-grain floor (ADR-013) ---- */
  const baseGrainBps = resolved.reduce((a, r, i) => (r.ing.isBaseGrain ? a + ratioBps[i]! : a), 0n);
  if (baseGrainBps < BigInt(store.minBaseGrainBps)) {
    throw new MixError(
      'BASE_GRAIN_BELOW_MINIMUM',
      `Base grain is ${(Number(baseGrainBps) / 100).toFixed(2)}% but at least ${(store.minBaseGrainBps / 100).toFixed(2)}% is required`,
      {
        actualBps: Number(baseGrainBps),
        requiredBps: store.minBaseGrainBps,
        shortfallBps: Number(BigInt(store.minBaseGrainBps) - baseGrainBps),
      },
    );
  }

  /* ---- 6. Per-ingredient caps (ADR-013) ---- */
  resolved.forEach((r, i) => {
    const cap = r.ing.maxPctBps;
    if (cap !== null && ratioBps[i]! > BigInt(cap)) {
      throw new MixError(
        'INGREDIENT_OVER_CAP',
        `${r.ing.name} is ${(Number(ratioBps[i]!) / 100).toFixed(2)}% but its maximum is ${(cap / 100).toFixed(2)}%`,
        {
          ingredientId: r.ing.id,
          name: r.ing.name,
          actualBps: Number(ratioBps[i]!),
          maxBps: cap,
        },
      );
    }
  });

  /* ---- 7. Nutrition: ratio-weighted mean per 100 g ----
   * Formula verified against the client's spreadsheet: it reproduces 4 of their
   * 5 blend panels to 2 decimal places (discovery/FINDINGS.md §1). The fifth
   * (Vitality) is wrong in the sheet, not in the formula.
   */
  const nutrition: NutrientResult[] = nutrientCodes.map((code) => {
    let acc = 0n;
    const sources = new Set<NutrientSource>();
    resolved.forEach((r, i) => {
      const v = r.ing.nutrients[code];
      if (v === undefined) {
        // Unreachable: assertIngredientComplete already guaranteed presence.
        throw new MixError('INCOMPLETE_INGREDIENT_DATA', `${r.ing.name} lacks ${code}`, {
          ingredientId: r.ing.id,
          nutrient: code,
        });
      }
      acc += ratioBps[i]! * BigInt(v);
      sources.add(r.ing.nutrientSources?.[code] ?? 'CLIENT');
    });
    return {
      code,
      valueScaled: Number(roundHalfUp(acc, BPS_TOTAL)),
      sources: [...sources].sort(),
    };
  });

  /* ---- 8. Pricing (ADR-008) ----
   * exact_i = weightG_i × sellPaisePerKg_i  (units: g·paise/kg)
   * raw     = Σ exact_i / 1000
   *
   * Line prices are allocated from the ROUNDED total by largest-remainder, so
   * Σ(linePaise) === rawPaise exactly. Rounding each line independently is the
   * classic off-by-one-paise invoice bug; this makes it structurally impossible.
   */
  const exactLinePaise = resolved.map((r) => r.weightG * BigInt(r.ing.sellPaisePerKg));
  const rawPaise = roundHalfUp(
    exactLinePaise.reduce((a, b) => a + b, 0n),
    GRAMS_PER_KG,
  );
  const allocatedLines = largestRemainder(exactLinePaise, rawPaise);
  assertSum(allocatedLines, rawPaise, 'line prices sum to raw total');

  const exactCost = resolved.reduce((a, r) => a + r.weightG * BigInt(r.ing.costPaisePerKg), 0n);
  const internalCostRaw = roundHalfUp(exactCost, GRAMS_PER_KG);

  const millingPaise = roundHalfUp(targetG * BigInt(store.millingFeePaisePerKg), GRAMS_PER_KG);
  const packagingPaise = BigInt(req.packageCount) * BigInt(store.packagingFeePaise);
  const subtotalPaise = rawPaise + millingPaise + packagingPaise;

  // GST-INCLUSIVE: the tax is contained within the subtotal, not added to it.
  const gstDenominator = BPS_TOTAL + BigInt(store.gstRateBps);
  const gstPaise = roundHalfUp(subtotalPaise * BigInt(store.gstRateBps), gstDenominator);
  const cgstPaise = gstPaise / 2n; // floor
  const sgstPaise = gstPaise - cgstPaise; // remainder to SGST so the split sums exactly

  // Internal cost also carries milling + packaging; margin is on the GST-inclusive price.
  const internalCostPaise =
    internalCostRaw + roundHalfUp(targetG * BigInt(store.millingFeePaisePerKg), GRAMS_PER_KG) + packagingPaise;
  const marginBps =
    subtotalPaise === 0n ? 0n : roundHalfUp((subtotalPaise - internalCostPaise) * BPS_TOTAL, subtotalPaise);

  const composition: CompositionLine[] = resolved.map((r, i) => ({
    ingredientId: r.ing.id,
    name: r.ing.name,
    weightG: Number(r.weightG),
    ratioBps: Number(ratioBps[i]!),
    displayPercent: `${(Number(ratioBps[i]!) / 100).toFixed(1)}%`,
    isBaseGrain: r.ing.isBaseGrain,
    sellRatePaisePerKg: r.ing.sellPaisePerKg,
    linePaise: Number(allocatedLines[i]!),
  }));

  return {
    engineVersion: ENGINE_VERSION,
    targetWeightG: req.targetWeightG,
    packageCount: req.packageCount,
    baseGrainBps: Number(baseGrainBps),
    composition,
    nutrition: {
      per100g: nutrition,
      estimated: true,
      sources: [...new Set(nutrition.flatMap((n) => n.sources))].sort(),
    },
    pricing: {
      rawPaise: Number(rawPaise),
      millingPaise: Number(millingPaise),
      packagingPaise: Number(packagingPaise),
      subtotalPaise: Number(subtotalPaise),
      gstRateBps: store.gstRateBps,
      gstPaise: Number(gstPaise),
      cgstPaise: Number(cgstPaise),
      sgstPaise: Number(sgstPaise),
      deliveryPaise: store.deliveryFeePaise,
      totalPaise: Number(subtotalPaise),
      internalCostPaise: Number(internalCostPaise),
      marginBps: Number(marginBps),
      currency: 'INR',
    },
  };
}

/**
 * Scale an arbitrary set of RATIOS to exact integer grams that sum precisely to
 * a target weight. This is the "build a ratio, pick a pack size" UX (ADR-013):
 * the customer thinks in percentages, the system does the arithmetic in grams.
 *
 * Ratios need not sum to 10000 on input — they are normalised here. The output
 * is guaranteed to sum to `targetWeightG` exactly (R1.1).
 */
export function scaleRatiosToWeight(
  ratios: ReadonlyArray<{ ingredientId: string; ratio: number }>,
  targetWeightG: number,
): Array<{ ingredientId: string; weightG: number }> {
  if (ratios.length === 0) throw new MixError('EMPTY_MIX', 'No ingredients supplied');
  if (ratios.length > MAX_ITEMS) {
    throw new MixError('TOO_MANY_ITEMS', `A mix may contain at most ${MAX_ITEMS} ingredients`, {
      max: MAX_ITEMS,
      actual: ratios.length,
    });
  }
  if (!Number.isInteger(targetWeightG) || targetWeightG <= 0) {
    throw new MixError('INVALID_TARGET_WEIGHT', 'targetWeightG must be a positive integer', {
      targetWeightG,
    });
  }
  if (BigInt(targetWeightG) < BigInt(ratios.length)) {
    throw new MixError(
      'INVALID_TARGET_WEIGHT',
      `Cannot split ${targetWeightG} g across ${ratios.length} ingredients — each needs at least 1 g`,
      { targetWeightG, ingredientCount: ratios.length },
    );
  }
  const ids = new Set<string>();
  for (const r of ratios) {
    if (ids.has(r.ingredientId)) {
      throw new MixError('DUPLICATE_INGREDIENT', `Ingredient ${r.ingredientId} appears twice`, {
        ingredientId: r.ingredientId,
      });
    }
    ids.add(r.ingredientId);
    if (!Number.isInteger(r.ratio) || r.ratio <= 0) {
      throw new MixError('INVALID_WEIGHT', 'ratio must be a positive integer', {
        ingredientId: r.ingredientId,
        ratio: r.ratio,
      });
    }
  }
  const grams = largestRemainder(
    ratios.map((r) => BigInt(r.ratio)),
    BigInt(targetWeightG),
  );
  assertSum(grams, BigInt(targetWeightG), 'scaled weights sum to target (R1.1)');

  /*
   * Honesty over convenience. If an ingredient's share rounds to 0 g, the recipe
   * is physically un-millable at this pack size (0.6 g of chia in a 10 kg bag is
   * not an ingredient, it is a rounding artefact). We REFUSE rather than
   * silently bump it to 1 g — bumping would (a) alter the customer's recipe
   * without telling them and (b) break idempotency of this function, which is a
   * promised invariant. The error tells them exactly how to fix it.
   */
  const sumRatios = ratios.reduce((a, r) => a + BigInt(r.ratio), 0n);
  grams.forEach((g, i) => {
    if (g === 0n) {
      throw new MixError(
        'INGREDIENT_TOO_SMALL',
        `Ingredient ${ratios[i]!.ingredientId} would be less than 1 g at ${targetWeightG} g — increase its share or remove it`,
        {
          ingredientId: ratios[i]!.ingredientId,
          ratio: ratios[i]!.ratio,
          targetWeightG,
          minRatioForOneGram: Number(ceilDiv(sumRatios, BigInt(targetWeightG))),
        },
      );
    }
  });

  return ratios.map((r, i) => ({ ingredientId: r.ingredientId, weightG: Number(grams[i]!) }));
}

/* ------------------------------------------------------------------ *
 * Guards
 * ------------------------------------------------------------------ */

function assertRequest(req: MixRequest): void {
  if (!req.items || req.items.length === 0) {
    throw new MixError('EMPTY_MIX', 'A mix must contain at least one ingredient');
  }
  if (req.items.length < MIN_ITEMS) {
    throw new MixError('EMPTY_MIX', `A mix must contain at least ${MIN_ITEMS} ingredients`, {
      min: MIN_ITEMS,
      actual: req.items.length,
    });
  }
  if (req.items.length > MAX_ITEMS) {
    throw new MixError('TOO_MANY_ITEMS', `A mix may contain at most ${MAX_ITEMS} ingredients`, {
      max: MAX_ITEMS,
      actual: req.items.length,
    });
  }
  if (!Number.isInteger(req.targetWeightG) || req.targetWeightG <= 0) {
    throw new MixError('INVALID_TARGET_WEIGHT', 'targetWeightG must be a positive integer', {
      targetWeightG: req.targetWeightG,
    });
  }
  if (!Number.isInteger(req.packageCount) || req.packageCount <= 0) {
    throw new MixError('INVALID_PACKAGE_COUNT', 'packageCount must be a positive integer', {
      packageCount: req.packageCount,
    });
  }
  for (const item of req.items) {
    if (!Number.isInteger(item.weightG) || item.weightG <= 0) {
      throw new MixError('INVALID_WEIGHT', `weightG must be a positive integer`, {
        ingredientId: item.ingredientId,
        weightG: item.weightG,
      });
    }
  }
}

function assertStoreConfig(store: StoreConfig): void {
  const checks: Array<[string, boolean]> = [
    ['allowedPackSizesG must be non-empty', store.allowedPackSizesG.length > 0],
    ['allowedPackSizesG must be positive integers', store.allowedPackSizesG.every((s) => Number.isInteger(s) && s > 0)],
    [
      'millingFeePaisePerKg must be a non-negative integer',
      Number.isInteger(store.millingFeePaisePerKg) && store.millingFeePaisePerKg >= 0,
    ],
    [
      'packagingFeePaise must be a non-negative integer',
      Number.isInteger(store.packagingFeePaise) && store.packagingFeePaise >= 0,
    ],
    [
      'deliveryFeePaise must be a non-negative integer',
      Number.isInteger(store.deliveryFeePaise) && store.deliveryFeePaise >= 0,
    ],
    [
      'gstRateBps must be an integer in [0, 10000]',
      Number.isInteger(store.gstRateBps) && store.gstRateBps >= 0 && store.gstRateBps <= 10000,
    ],
    [
      'minBaseGrainBps must be an integer in [0, 10000]',
      Number.isInteger(store.minBaseGrainBps) && store.minBaseGrainBps >= 0 && store.minBaseGrainBps <= 10000,
    ],
  ];
  for (const [msg, ok] of checks) {
    if (!ok) throw new MixError('INVALID_CONFIG', msg);
  }
}

/**
 * THE VITALITY RULE (R1.3), enforced.
 *
 * An ingredient with a missing price or a missing nutrient is rejected outright.
 * It is never coerced to zero. The error names the exact ingredient and the exact
 * missing field so an admin can fix the data instead of a customer silently
 * receiving a wrong nutrition panel.
 */
function assertIngredientComplete(ing: Ingredient, nutrientCodes: readonly string[]): void {
  if (!Number.isInteger(ing.sellPaisePerKg) || ing.sellPaisePerKg <= 0) {
    throw new MixError('INCOMPLETE_INGREDIENT_DATA', `Ingredient "${ing.name}" has no valid selling rate`, {
      ingredientId: ing.id,
      name: ing.name,
      field: 'sellPaisePerKg',
      value: ing.sellPaisePerKg,
    });
  }
  if (!Number.isInteger(ing.costPaisePerKg) || ing.costPaisePerKg <= 0) {
    throw new MixError('INCOMPLETE_INGREDIENT_DATA', `Ingredient "${ing.name}" has no valid cost rate`, {
      ingredientId: ing.id,
      name: ing.name,
      field: 'costPaisePerKg',
      value: ing.costPaisePerKg,
    });
  }
  const missing = nutrientCodes.filter((code) => {
    const v = ing.nutrients[code];
    return v === undefined || !Number.isInteger(v);
  });
  if (missing.length > 0) {
    throw new MixError(
      'INCOMPLETE_INGREDIENT_DATA',
      `Ingredient "${ing.name}" is missing nutrient data: ${missing.join(', ')}`,
      { ingredientId: ing.id, name: ing.name, field: 'nutrients', missing },
    );
  }
  if (ing.maxPctBps !== null && (!Number.isInteger(ing.maxPctBps) || ing.maxPctBps < 0)) {
    throw new MixError('INCOMPLETE_INGREDIENT_DATA', `Ingredient "${ing.name}" has an invalid cap`, {
      ingredientId: ing.id,
      name: ing.name,
      field: 'maxPctBps',
      value: ing.maxPctBps,
    });
  }
}

function assertSum(values: readonly bigint[], expected: bigint, what: string): void {
  const actual = values.reduce((a, b) => a + b, 0n);
  if (actual !== expected) {
    throw new EngineBugError(`${what} violated: expected ${expected}, got ${actual}`);
  }
}

/** Convenience for display: paise → "₹1,234.56". Presentation only, never arithmetic. */
export function formatRupees(paise: number): string {
  if (!Number.isInteger(paise)) throw new EngineBugError('formatRupees: non-integer paise');
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const cents = String(abs % 100).padStart(2, '0');
  return `${sign}₹${rupees.toLocaleString('en-IN')}.${cents}`;
}
