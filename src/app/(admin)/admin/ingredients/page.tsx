import { asc, eq, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db/client';
import { ingredientNutrition, ingredients, stores } from '@/db/schema';
import { requireStaff } from '@/server/auth';
import { updateIngredientRate } from './actions';

export const dynamic = 'force-dynamic';
const moneyInput = (paise: number) => (paise / 100).toFixed(2);
const moneyLabel = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);

export default async function AdminIngredientsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const staff = await requireStaff();
  const { notice } = await searchParams;
  const predicate = staff.role === 'MANAGER' ? eq(ingredients.storeId, staff.storeId ?? '') : undefined;
  const rows = await db
    .select({ ingredient: ingredients, storeName: stores.name })
    .from(ingredients)
    .innerJoin(stores, eq(stores.id, ingredients.storeId))
    .where(predicate)
    .orderBy(asc(ingredients.category), asc(ingredients.name))
    .all();
  const nutrientRows = rows.length
    ? await db
        .selectDistinct({ ingredientId: ingredientNutrition.ingredientId })
        .from(ingredientNutrition)
        .where(
          inArray(
            ingredientNutrition.ingredientId,
            rows.map(({ ingredient }) => ingredient.id),
          ),
        )
        .all()
    : [];
  const hasNutrition = new Set(nutrientRows.map((row) => row.ingredientId));
  const provisionalCount = rows.filter(({ ingredient }) => ingredient.ratesProvisional).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-forest-700">Lab configuration</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-ink-900">Ingredient rates</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">
            Review each ingredient’s buying cost and customer-facing selling rate. Saving confirms both rates, preserves
            the change history, and updates Lab prices.
          </p>
        </div>
        <Link
          href="/admin/price-consistency"
          className="rounded-lg border border-forest-600 px-4 py-2.5 text-sm font-semibold text-forest-800 hover:bg-forest-50"
        >
          Price consistency
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-card border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-ink-700">
        <span className="font-semibold">{provisionalCount} provisional rate sets</span>
        <span className="text-ink-500">Saving a reviewed row marks its prices as client-confirmed.</span>
      </div>

      {notice === 'saved' && (
        <p role="status" className="rounded-lg border border-forest-100 bg-forest-50 px-4 py-3 text-sm text-forest-800">
          Rates saved. Price history and audit trail were recorded.
        </p>
      )}
      {notice === 'invalid' && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Enter positive prices in rupees with no more than two decimal places.
        </p>
      )}
      {notice === 'unavailable' && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          That ingredient is unavailable for this account.
        </p>
      )}
      {notice === 'save-failed' && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Could not save the rates. Nothing was changed; refresh and try again.
        </p>
      )}

      <div className="space-y-4">
        {rows.map(({ ingredient, storeName }) => (
          <article
            key={ingredient.id}
            className={
              ingredient.ratesProvisional
                ? 'rounded-card border border-gold-200 bg-white p-5 shadow-warm sm:p-6'
                : 'rounded-card border border-ivory-300 bg-white p-5 shadow-warm sm:p-6'
            }
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-semibold text-ink-900">{ingredient.name}</h2>
                  {ingredient.ratesProvisional && (
                    <span className="rounded-full bg-gold-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-bronze-800">
                      Provisional
                    </span>
                  )}
                  {!ingredient.active && (
                    <span className="rounded-full bg-ivory-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-600">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-ink-500">
                  {ingredient.id} · {ingredient.category ?? 'Uncategorised'} · {storeName}
                </p>
                <p className="mt-1 text-xs text-ink-500">
                  {ingredient.isBaseGrain ? 'Base grain' : 'Add-in'}
                  {ingredient.maxPctBps !== null ? ` · cap ${(ingredient.maxPctBps / 100).toFixed(2)}%` : ''}
                  {' · '}
                  {hasNutrition.has(ingredient.id) ? 'nutrition profile present' : 'nutrition data incomplete'}
                </p>
                {ingredient.reviewNote && (
                  <p className="mt-2 max-w-3xl text-xs leading-5 text-bronze-800">
                    Review note: {ingredient.reviewNote}
                  </p>
                )}
              </div>
              <Link
                href={`/admin/ingredients/${ingredient.id}`}
                className="text-xs font-bold text-forest-700 hover:underline"
              >
                Rate history →
              </Link>
            </div>

            <form
              action={updateIngredientRate}
              className="mt-5 grid gap-3 border-t border-ivory-200 pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            >
              <input type="hidden" name="ingredientId" value={ingredient.id} />
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Cost price (₹ / kg)</span>
                <input
                  name="costRupees"
                  required
                  inputMode="decimal"
                  pattern="[0-9]+(\.[0-9]{1,2})?"
                  defaultValue={moneyInput(ingredient.costPaisePerKg)}
                  aria-label={`${ingredient.name} cost price in rupees per kilogram`}
                  className="w-full rounded-lg border border-ivory-300 bg-ivory-50 px-3 py-2.5 text-sm tabular-nums text-ink-900"
                />
                <span className="block text-[11px] text-ink-500">
                  Current: {moneyLabel(ingredient.costPaisePerKg)} / kg · {ingredient.costSource}
                </span>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Selling price (₹ / kg)</span>
                <input
                  name="sellRupees"
                  required
                  inputMode="decimal"
                  pattern="[0-9]+(\.[0-9]{1,2})?"
                  defaultValue={moneyInput(ingredient.sellPaisePerKg)}
                  aria-label={`${ingredient.name} selling price in rupees per kilogram`}
                  className="w-full rounded-lg border border-ivory-300 bg-ivory-50 px-3 py-2.5 text-sm tabular-nums text-ink-900"
                />
                <span className="block text-[11px] text-ink-500">
                  Current: {moneyLabel(ingredient.sellPaisePerKg)} / kg · {ingredient.sellSource}
                </span>
              </label>
              <button
                type="submit"
                className="rounded-lg bg-forest-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-800"
              >
                Save & confirm
              </button>
            </form>
          </article>
        ))}
        {rows.length === 0 && (
          <p className="rounded-card border border-ivory-300 bg-white p-8 text-center text-sm text-ink-500">
            No ingredients are assigned to this store.
          </p>
        )}
      </div>
    </div>
  );
}
