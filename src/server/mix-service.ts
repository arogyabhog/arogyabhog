/**
 * Mix service: the only path from HTTP to the calculation engine.
 * Loads tenant-scoped rows, assembles engine inputs, returns the result plus
 * the provenance the UI must show (provisional-pricing chip, source labels).
 */
import { and, eq, inArray } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { ingredientNutrition, ingredients, stores } from '../db/schema';
import {
  calculateMix,
  type Ingredient,
  MixError,
  type MixResult,
  type NutrientSource,
  type StoreConfig,
} from '../domain/mix-engine';
import { DISPLAY_NUTRIENTS, type MixCalculateRequest } from './contracts';

export interface MixCalculation {
  mix: MixResult;
  /** True when any priced ingredient still carries a provisional seed rate (ADR-026). */
  provisionalPricing: boolean;
  /** ingredientId → nutrientKey → engine source union, for the ADR-007 labels. */
  nutritionSources: Record<string, Record<string, NutrientSource>>;
}

/** DB stores human-readable provenance; the engine speaks a strict union. */
function toSource(s: string): NutrientSource {
  if (/IFCT/i.test(s)) return 'IFCT2017';
  if (/USDA/i.test(s)) return 'USDA';
  if (/LAB/i.test(s)) return 'LAB';
  if (/CLIENT/i.test(s)) return 'CLIENT';
  throw new MixError('INCOMPLETE_INGREDIENT_DATA', `Unmapped nutrient source "${s}"`, { source: s });
}

export async function calculateMixFromDb<S extends Record<string, unknown> = Record<string, never>>(
  db: LibSQLDatabase<S>,
  req: MixCalculateRequest,
): Promise<MixCalculation> {
  const store = await db.select().from(stores).where(eq(stores.id, req.storeId)).get();
  if (!store) {
    throw new MixError('STORE_NOT_FOUND', `Unknown store ${req.storeId}`, { storeId: req.storeId });
  }

  const ids = [...new Set(req.items.map((i) => i.ingredientId))];
  const rows = await db
    .select()
    .from(ingredients)
    .where(and(eq(ingredients.storeId, req.storeId), inArray(ingredients.id, ids)))
    .all();

  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const id of ids) {
    if (!byId.has(id)) {
      throw new MixError('INGREDIENT_UNKNOWN', `Ingredient ${id} is not on this store's catalogue`, {
        ingredientId: id,
      });
    }
  }
  const inactive = rows.filter((r) => !r.active).map((r) => r.id);
  if (inactive.length > 0) {
    throw new MixError('INGREDIENT_UNKNOWN', 'Ingredient is not currently sold', {
      ingredientIds: inactive,
    });
  }

  const nutritionRows = await db
    .select()
    .from(ingredientNutrition)
    .where(inArray(ingredientNutrition.ingredientId, ids))
    .all();

  const nutrientsByIng = new Map<string, Record<string, number>>();
  const sourcesByIng: Record<string, Record<string, NutrientSource>> = {};
  for (const n of nutritionRows) {
    const bag = nutrientsByIng.get(n.ingredientId) ?? {};
    bag[n.nutrientKey] = n.valueX100;
    nutrientsByIng.set(n.ingredientId, bag);
    const sourceBag = sourcesByIng[n.ingredientId] ?? {};
    sourceBag[n.nutrientKey] = toSource(n.source);
    sourcesByIng[n.ingredientId] = sourceBag;
  }

  const catalog = new Map<string, Ingredient>(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        name: r.name,
        isBaseGrain: r.isBaseGrain,
        maxPctBps: r.maxPctBps,
        sellPaisePerKg: r.sellPaisePerKg,
        costPaisePerKg: r.costPaisePerKg,
        nutrients: nutrientsByIng.get(r.id) ?? {},
        nutrientSources: sourcesByIng[r.id],
      },
    ]),
  );

  const storeConfig: StoreConfig = {
    allowedPackSizesG: JSON.parse(store.allowedPackSizesG) as number[],
    millingFeePaisePerKg: store.millingFeePaisePerKg,
    packagingFeePaise: store.packagingFeePaise,
    deliveryFeePaise: store.deliveryFeePaise,
    gstRateBps: store.gstRateBps,
    minBaseGrainBps: store.minBaseGrainBps,
  };

  const mix = calculateMix(
    {
      targetWeightG: req.targetWeightG,
      packageCount: req.packageCount,
      items: req.items.map((i) => ({ ingredientId: i.ingredientId, weightG: i.weightG })),
    },
    catalog,
    storeConfig,
    [...DISPLAY_NUTRIENTS],
  );

  return {
    mix,
    provisionalPricing: rows.some((r) => r.ratesProvisional),
    nutritionSources: sourcesByIng,
  };
}
