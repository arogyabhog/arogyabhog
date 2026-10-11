import { roundHalfUp, scaleRatiosToWeight } from './mix-engine';

export interface RebuildIngredient {
  ingredientId: string;
  ratioBps: number;
  sellPaisePerKg: number;
  provisional: boolean;
}

export interface RebuildFees {
  millingFeePaisePerKg: number;
  packagingFeePaise: number;
  gstRateBps: number;
}

export interface RecipeRebuildPrice {
  rawPaise: number;
  millingPaise: number;
  packagingPaise: number;
  gstPaise: number;
  /** GST-inclusive equivalent shelf price, excluding order-level delivery. */
  equivalentPaise: number;
  provisionalPricing: boolean;
}

/** Price a locked premade recipe through the Lab's integer-money formula. */
export function priceRecipeRebuild(
  ingredients: RebuildIngredient[],
  targetWeightG: number,
  packageCount: number,
  fees: RebuildFees,
): RecipeRebuildPrice {
  if (!Number.isInteger(packageCount) || packageCount < 1) throw new Error('packageCount must be a positive integer');
  if (ingredients.reduce((sum, item) => sum + item.ratioBps, 0) !== 10000) {
    throw new Error('Recipe ratios must total exactly 10,000 basis points.');
  }
  if (ingredients.some((item) => !Number.isSafeInteger(item.sellPaisePerKg) || item.sellPaisePerKg < 1)) {
    throw new Error('Every ingredient needs a positive integer selling rate.');
  }
  if (![fees.millingFeePaisePerKg, fees.packagingFeePaise, fees.gstRateBps].every(Number.isSafeInteger)) {
    throw new Error('Fees and tax must be integer values.');
  }
  if (fees.millingFeePaisePerKg < 0 || fees.packagingFeePaise < 0 || fees.gstRateBps < 0 || fees.gstRateBps > 10000) {
    throw new Error('Fees and tax are outside their valid ranges.');
  }

  const weights = scaleRatiosToWeight(
    ingredients.map(({ ingredientId, ratioBps }) => ({ ingredientId, ratio: ratioBps })),
    targetWeightG,
  );
  const rateById = new Map(ingredients.map((item) => [item.ingredientId, item.sellPaisePerKg]));
  let exactRawNumerator = 0n;
  for (const line of weights) {
    const rate = rateById.get(line.ingredientId);
    if (rate === undefined) throw new Error(`Missing rate for ${line.ingredientId}.`);
    exactRawNumerator += BigInt(line.weightG) * BigInt(rate);
  }
  const rawPaise = roundHalfUp(exactRawNumerator, 1000n);
  const millingPaise = roundHalfUp(BigInt(targetWeightG) * BigInt(fees.millingFeePaisePerKg), 1000n);
  const packagingPaise = BigInt(packageCount) * BigInt(fees.packagingFeePaise);
  const subtotalPaise = rawPaise + millingPaise + packagingPaise;
  const gstPaise = roundHalfUp(subtotalPaise * BigInt(fees.gstRateBps), 10000n + BigInt(fees.gstRateBps));
  const equivalent = Number(subtotalPaise);
  if (!Number.isSafeInteger(equivalent)) throw new Error('Equivalent price exceeds safe integer range.');

  return {
    rawPaise: Number(rawPaise),
    millingPaise: Number(millingPaise),
    packagingPaise: Number(packagingPaise),
    gstPaise: Number(gstPaise),
    equivalentPaise: equivalent,
    provisionalPricing: ingredients.some((item) => item.provisional),
  };
}

export interface PriceGap {
  differencePaise: number;
  differenceBps: number;
  outsideTolerance: boolean;
  needsReview: boolean;
}

/** Positive means the Lab-built recipe would cost more than the standard shelf item. */
export function compareRecipePrice(
  equivalentPaise: number,
  shelfPaise: number,
  toleranceBps: number,
  provisionalPricing: boolean,
): PriceGap {
  if (![equivalentPaise, shelfPaise, toleranceBps].every(Number.isSafeInteger) || shelfPaise <= 0 || toleranceBps < 0) {
    throw new Error('Prices and tolerance must be valid integer paise/basis-point values.');
  }
  const difference = BigInt(equivalentPaise) - BigInt(shelfPaise);
  const differencePaise = Number(difference);
  const differenceBps = Number(roundHalfUp(difference * 10000n, BigInt(shelfPaise)));
  if (!Number.isSafeInteger(differencePaise) || !Number.isSafeInteger(differenceBps)) {
    throw new Error('Price difference exceeds safe integer range.');
  }
  const outsideTolerance = Math.abs(differenceBps) > toleranceBps;
  return {
    differencePaise,
    differenceBps,
    outsideTolerance,
    needsReview: provisionalPricing || outsideTolerance,
  };
}
