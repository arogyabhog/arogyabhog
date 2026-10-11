import { and, eq, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db/client';
import { ingredients, productRecipeLines, products, productVariants, stores } from '@/db/schema';
import { compareRecipePrice, priceRecipeRebuild } from '@/domain/price-consistency';
import { requireStaff } from '@/server/auth';

export const dynamic = 'force-dynamic';

const money = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);
const signedMoney = (paise: number) => `${paise > 0 ? '+' : paise < 0 ? '−' : ''}${money(Math.abs(paise))}`;

interface CheckRow {
  storeName: string;
  productId: string;
  productName: string;
  packSizeG: number;
  shelfPaise: number;
  toleranceBps: number;
  equivalentPaise?: number;
  rawPaise?: number;
  millingPaise?: number;
  packagingPaise?: number;
  differencePaise?: number;
  differenceBps?: number;
  provisional?: boolean;
  outsideTolerance?: boolean;
  error?: string;
}

export default async function PriceConsistencyPage() {
  const staff = await requireStaff();
  const storeRows =
    staff.role === 'ADMIN'
      ? await db.select().from(stores).all()
      : await db
          .select()
          .from(stores)
          .where(eq(stores.id, staff.storeId ?? ''))
          .all();
  const checks: CheckRow[] = [];

  for (const store of storeRows) {
    const premades = await db
      .select()
      .from(products)
      .where(and(eq(products.storeId, store.id), eq(products.kind, 'premade'), eq(products.status, 'active')))
      .all();
    if (!premades.length) continue;
    const productIds = premades.map((product) => product.id);
    const variants = await db
      .select()
      .from(productVariants)
      .where(and(inArray(productVariants.productId, productIds), eq(productVariants.active, true)))
      .all();
    const recipeLines = await db
      .select()
      .from(productRecipeLines)
      .where(inArray(productRecipeLines.productId, productIds))
      .all();
    const storeIngredients = await db.select().from(ingredients).where(eq(ingredients.storeId, store.id)).all();
    const ingredientById = new Map(storeIngredients.map((ingredient) => [ingredient.id, ingredient]));

    for (const product of premades) {
      const lines = recipeLines.filter((line) => line.productId === product.id);
      const productVariantsList = variants.filter((variant) => variant.productId === product.id);
      for (const variant of productVariantsList) {
        const base: CheckRow = {
          storeName: store.name,
          productId: product.id,
          productName: product.name,
          packSizeG: variant.packSizeG,
          shelfPaise: variant.sellPaise,
          toleranceBps: store.priceConsistencyToleranceBps,
        };
        const pricedIngredients = lines.flatMap((line) => {
          const ingredient = ingredientById.get(line.ingredientId);
          return ingredient
            ? [
                {
                  ingredientId: ingredient.id,
                  ratioBps: line.ratioBps,
                  sellPaisePerKg: ingredient.sellPaisePerKg,
                  provisional: ingredient.ratesProvisional,
                },
              ]
            : [];
        });
        if (!lines.length || pricedIngredients.length !== lines.length) {
          checks.push({ ...base, error: 'Recipe is empty or an ingredient rate is missing for this store.' });
          continue;
        }
        try {
          const rebuild = priceRecipeRebuild(pricedIngredients, variant.packSizeG, 1, {
            millingFeePaisePerKg: store.millingFeePaisePerKg,
            packagingFeePaise: store.packagingFeePaise,
            gstRateBps: store.gstRateBps,
          });
          const gap = compareRecipePrice(
            rebuild.equivalentPaise,
            variant.sellPaise,
            store.priceConsistencyToleranceBps,
            rebuild.provisionalPricing,
          );
          checks.push({
            ...base,
            equivalentPaise: rebuild.equivalentPaise,
            rawPaise: rebuild.rawPaise,
            millingPaise: rebuild.millingPaise,
            packagingPaise: rebuild.packagingPaise,
            differencePaise: gap.differencePaise,
            differenceBps: gap.differenceBps,
            provisional: rebuild.provisionalPricing,
            outsideTolerance: gap.outsideTolerance,
          });
        } catch (error) {
          checks.push({ ...base, error: error instanceof Error ? error.message : 'Could not rebuild this recipe.' });
        }
      }
    }
  }

  const reviewCount = checks.filter((row) => row.error || row.provisional || row.outsideTolerance).length;
  const toleranceText = storeRows.length ? 'configured per store' : 'not configured';
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-forest-700">Pricing guard</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-ink-900">Price consistency</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-500">
            Compares each active premade pack with the same recipe rebuilt at current ingredient selling rates, milling,
            packaging, and inclusive GST. Order-level delivery is excluded. Store tolerance is {toleranceText}.
          </p>
        </div>
        <Link
          href="/admin/ingredients"
          className="rounded-lg bg-forest-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-800"
        >
          Review ingredient rates
        </Link>
      </div>

      <div
        className={
          reviewCount
            ? 'rounded-card border border-gold-200 bg-gold-50 px-5 py-4'
            : 'rounded-card border border-forest-100 bg-forest-50 px-5 py-4'
        }
      >
        <p className="font-semibold text-ink-900">
          {reviewCount
            ? `${reviewCount} pack comparisons need review`
            : 'All active pack comparisons are within the configured tolerance.'}
        </p>
        <p className="mt-1 text-xs leading-5 text-ink-600">
          Provisional ingredient rates always remain warnings, even if the price gap is small. A gap beyond the store
          tolerance is also flagged.
        </p>
      </div>

      <div className="overflow-x-auto rounded-card border border-ivory-300 bg-white shadow-warm">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-forest-900 text-left text-xs uppercase tracking-wide text-gold-200">
            <tr>
              <th className="px-4 py-3 font-bold">Premade item</th>
              <th className="px-4 py-3 font-bold">Standard pack price</th>
              <th className="px-4 py-3 font-bold">Lab equivalent</th>
              <th className="px-4 py-3 font-bold">Difference</th>
              <th className="px-4 py-3 font-bold">Review state</th>
              <th className="px-4 py-3 font-bold">
                <span className="sr-only">Manage</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {checks.map((row) => {
              const needsReview = !!row.error || !!row.provisional || !!row.outsideTolerance;
              return (
                <tr key={`${row.productId}:${row.packSizeG}`} className="border-b border-ivory-200 last:border-b-0">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-ink-900">
                      {row.productName} · {row.packSizeG / 1000} kg
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      {row.storeName} · tolerance {(row.toleranceBps / 100).toFixed(2)}%
                    </p>
                  </td>
                  <td className="tnum px-4 py-4">{money(row.shelfPaise)}</td>
                  <td className="px-4 py-4">
                    {row.error ? (
                      <span className="text-xs text-red-700">Unavailable</span>
                    ) : (
                      <>
                        <span className="tnum font-semibold text-ink-900">{money(row.equivalentPaise ?? 0)}</span>
                        <span className="mt-1 block text-[11px] text-ink-500">
                          raw {money(row.rawPaise ?? 0)} · milling {money(row.millingPaise ?? 0)} · pack{' '}
                          {money(row.packagingPaise ?? 0)}
                        </span>
                      </>
                    )}
                  </td>
                  <td
                    className={
                      needsReview
                        ? 'tnum px-4 py-4 font-semibold text-bronze-800'
                        : 'tnum px-4 py-4 font-semibold text-forest-800'
                    }
                  >
                    {row.error ? (
                      '—'
                    ) : (
                      <>
                        {signedMoney(row.differencePaise ?? 0)}{' '}
                        <span className="block text-xs">{((row.differenceBps ?? 0) / 100).toFixed(2)}%</span>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {row.error ? (
                      <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800">
                        Data gap
                      </span>
                    ) : needsReview ? (
                      <div className="space-y-1">
                        <span className="rounded-full bg-gold-100 px-2.5 py-1 text-xs font-semibold text-bronze-800">
                          Review
                        </span>
                        {row.provisional && (
                          <span className="block text-[10px] text-bronze-800">Provisional rates</span>
                        )}
                        {row.outsideTolerance && (
                          <span className="block text-[10px] text-bronze-800">Outside tolerance</span>
                        )}
                      </div>
                    ) : (
                      <span className="rounded-full bg-forest-50 px-2.5 py-1 text-xs font-semibold text-forest-800">
                        Within tolerance
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      href={`/admin/products/${row.productId}`}
                      className="text-xs font-bold text-forest-700 hover:underline"
                    >
                      Edit blend
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!checks.length && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-ink-500">
                  No active premade packs to compare.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
