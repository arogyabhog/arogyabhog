/**
 * Shared storefront queries. Every page (home, shop, PDP, lab) reads the SAME
 * database through here — no page owns private data logic, so renaming or
 * re-pricing (ADR-020/026) never means touching components.
 */
import { eq } from 'drizzle-orm';
import type { IngProp, PreMadeProp } from '@/components/LabClient';
import { db } from '@/db/client';
import { ingredientNutrition, ingredients, productRecipeLines, products, productVariants } from '@/db/schema';
import { SEED_STORE_ID } from '@/db/seed';

const PACK_IMG: Record<string, string> = {
  'everyday-atta': '/img/pack-everyday.png',
  'sugar-care-atta': '/img/pack-sugar-care.png',
  'thyro-care-atta': '/img/pack-thyro-care.png',
  'high-protein-atta': '/img/pack-high-protein.png',
  'vitality-atta': '/img/pack-vitality.png',
};

export async function getStorefront(): Promise<{ ingredients: IngProp[]; preMades: PreMadeProp[] }> {
  const ings = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      category: ingredients.category,
      isBaseGrain: ingredients.isBaseGrain,
      maxPctBps: ingredients.maxPctBps,
    })
    .from(ingredients)
    .where(eq(ingredients.storeId, SEED_STORE_ID));

  const withNutrition = new Set(
    (await db.selectDistinct({ id: ingredientNutrition.ingredientId }).from(ingredientNutrition)).map((r) => r.id),
  );

  const prods = await db.select().from(products).where(eq(products.storeId, SEED_STORE_ID));
  const variants = await db.select().from(productVariants);
  const lines = await db.select().from(productRecipeLines);

  const preMades: PreMadeProp[] = prods.map((p) => {
    const v = variants.find((x) => x.productId === p.id && x.packSizeG === 10000);
    const named = lines
      .filter((l) => l.productId === p.id)
      .map((l) => ({
        id: l.ingredientId,
        name: ings.find((i) => i.id === l.ingredientId)?.name ?? l.ingredientId,
        bps: l.ratioBps,
      }))
      .sort((a, b) => b.bps - a.bps);
    return {
      name: p.name,
      slug: p.slug,
      img: PACK_IMG[p.slug] ?? '/brand/logo-mark.png',
      sellPaise: v?.sellPaise ?? 0,
      provisional: Boolean(v?.provisional),
      lines: named.map((n) => ({ name: n.name, bps: n.bps })),
      template: named.map((n) => ({ id: n.id, g: n.bps })), // bps == grams at 10 kg
    };
  });

  return {
    ingredients: ings.map((i) => ({ ...i, hasNutrition: withNutrition.has(i.id) })),
    preMades,
  };
}

export async function getPreMade(slug: string) {
  const { preMades } = await getStorefront();
  return preMades.find((p) => p.slug === slug) ?? null;
}
