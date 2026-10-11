import { and, asc, desc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { ingredients, productRecipeLines, products, productVariants } from '@/db/schema';
import { canManageOrder } from '@/server/admin-order-access';
import { requireStaff } from '@/server/auth';
import { updateProductDetails, updateProductRecipe, updateProductVariant } from '../actions';

export const dynamic = 'force-dynamic';

const rupees = (paise: number) => (paise / 100).toFixed(2);
const noticeText: Record<string, string> = {
  saved: 'Product details saved and audited.',
  'variant-saved': 'Pack price saved, marked as client-confirmed, and audited.',
  'recipe-saved': 'Blend composition saved and audited.',
  'invalid-recipe':
    'Recipe must keep the existing ingredients and total exactly 10,000 basis points (100%). No changes were saved.',
  'save-failed': 'The update could not be saved. Refresh and try again.',
};

export default async function AdminProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const staff = await requireStaff();
  const { id } = await params;
  const { notice } = await searchParams;
  const product = await db.select().from(products).where(eq(products.id, id)).get();
  if (!product || !canManageOrder({ role: staff.role, storeId: staff.storeId }, product.storeId)) notFound();

  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, product.id))
    .orderBy(asc(productVariants.packSizeG))
    .all();
  const recipeRows =
    product.kind === 'premade'
      ? await db
          .select({ ingredientId: ingredients.id, name: ingredients.name, ratioBps: productRecipeLines.ratioBps })
          .from(productRecipeLines)
          .innerJoin(ingredients, eq(ingredients.id, productRecipeLines.ingredientId))
          .where(and(eq(productRecipeLines.productId, product.id), eq(ingredients.storeId, product.storeId)))
          .orderBy(desc(productRecipeLines.ratioBps))
          .all()
      : [];

  return (
    <div className="space-y-7">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-forest-700">
          Catalog · {product.kind === 'single' ? 'single grain' : 'house blend'}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink-900">{product.name}</h1>
        <p className="mt-2 text-sm text-ink-500">
          Storefront URL: <span className="font-mono">/shop/{product.slug}</span>
        </p>
      </div>

      {notice && noticeText[notice] && (
        <p
          role={notice === 'invalid-recipe' || notice === 'save-failed' ? 'alert' : 'status'}
          className={
            notice === 'invalid-recipe' || notice === 'save-failed'
              ? 'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'
              : 'rounded-lg border border-forest-100 bg-forest-50 px-4 py-3 text-sm text-forest-800'
          }
        >
          {noticeText[notice]}
        </p>
      )}

      <section className="rounded-card border border-ivory-300 bg-white p-5 shadow-warm sm:p-6">
        <div className="mb-5">
          <h2 className="font-display text-xl font-semibold text-ink-900">Product details</h2>
          <p className="mt-1 text-xs text-ink-500">
            Names and copy are editable. Slug stays fixed so old product links do not break.
          </p>
        </div>
        <form action={updateProductDetails} className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="productId" value={product.id} />
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Name</span>
            <input
              name="name"
              required
              minLength={2}
              maxLength={100}
              defaultValue={product.name}
              className="w-full rounded-lg border border-ivory-300 bg-ivory-50 px-3 py-2.5 text-sm text-ink-900"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Status</span>
            <select
              name="status"
              defaultValue={product.status === 'inactive' ? 'inactive' : 'active'}
              className="w-full rounded-lg border border-ivory-300 bg-ivory-50 px-3 py-2.5 text-sm text-ink-900"
            >
              <option value="active">Active — visible in shop</option>
              <option value="inactive">Inactive — hide from shop</option>
            </select>
          </label>
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Description</span>
            <textarea
              name="description"
              maxLength={2000}
              rows={4}
              defaultValue={product.description ?? ''}
              className="w-full rounded-lg border border-ivory-300 bg-ivory-50 px-3 py-2.5 text-sm leading-6 text-ink-900"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-forest-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-800"
            >
              Save details
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-900">Pack variants & prices</h2>
          <p className="mt-1 text-xs leading-5 text-ink-500">
            Edit each pack independently. Saving a price marks it client-confirmed and removes its provisional label.
          </p>
        </div>
        {variants.length ? (
          variants.map((variant) => (
            <form
              key={variant.packSizeG}
              action={updateProductVariant}
              className="grid gap-4 rounded-card border border-ivory-300 bg-white p-5 shadow-warm sm:grid-cols-[100px_1fr_1fr_180px_auto] sm:items-end"
            >
              <input type="hidden" name="productId" value={product.id} />
              <input type="hidden" name="packSizeG" value={variant.packSizeG} />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Pack</p>
                <p className="mt-1 font-display text-xl font-semibold text-ink-900">{variant.packSizeG / 1000} kg</p>
              </div>
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Cost (₹)</span>
                <input
                  name="costRupees"
                  required
                  inputMode="decimal"
                  pattern="[0-9]+(\.[0-9]{1,2})?"
                  defaultValue={rupees(variant.costPaise)}
                  className="w-full rounded-lg border border-ivory-300 bg-ivory-50 px-3 py-2.5 text-sm tabular-nums"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Selling price (₹)</span>
                <input
                  name="sellRupees"
                  required
                  inputMode="decimal"
                  pattern="[0-9]+(\.[0-9]{1,2})?"
                  defaultValue={rupees(variant.sellPaise)}
                  className="w-full rounded-lg border border-ivory-300 bg-ivory-50 px-3 py-2.5 text-sm tabular-nums"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Visibility</span>
                <select
                  name="active"
                  defaultValue={variant.active ? 'active' : 'inactive'}
                  className="w-full rounded-lg border border-ivory-300 bg-ivory-50 px-3 py-2.5 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <div className="flex items-center gap-3 sm:justify-end">
                {variant.provisional && (
                  <span className="rounded-full bg-gold-100 px-2.5 py-1 text-[10px] font-bold text-bronze-800">
                    Provisional
                  </span>
                )}
                <button
                  type="submit"
                  className="rounded-lg border border-forest-600 px-4 py-2.5 text-sm font-semibold text-forest-800 hover:bg-forest-50"
                >
                  Save pack
                </button>
              </div>
            </form>
          ))
        ) : (
          <p className="rounded-card border border-ivory-300 bg-white p-5 text-sm text-ink-500">
            No pack variants configured.
          </p>
        )}
      </section>

      {product.kind === 'premade' && (
        <section className="rounded-card border border-ivory-300 bg-white p-5 shadow-warm sm:p-6">
          <div className="mb-5">
            <h2 className="font-display text-xl font-semibold text-ink-900">Blend composition</h2>
            <p className="mt-1 text-xs leading-5 text-ink-500">
              Adjust the existing ingredients. Ratios must add up to exactly 100.00%. Adding or removing ingredients is
              intentionally disabled in this editor.
            </p>
          </div>
          {recipeRows.length ? (
            <form action={updateProductRecipe} className="space-y-3">
              <input type="hidden" name="productId" value={product.id} />
              {recipeRows.map((line) => (
                <div
                  key={line.ingredientId}
                  className="grid grid-cols-[minmax(0,1fr)_130px] items-center gap-3 border-b border-ivory-200 pb-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{line.name}</p>
                    <input type="hidden" name="ingredientId" value={line.ingredientId} />
                  </div>
                  <label className="flex items-center gap-2">
                    <span className="sr-only">{line.name} ratio in basis points</span>
                    <input
                      type="number"
                      name="ratioBps"
                      min={1}
                      max={10000}
                      step={1}
                      required
                      defaultValue={line.ratioBps}
                      className="w-full rounded-lg border border-ivory-300 bg-ivory-50 px-3 py-2 text-right text-sm tabular-nums"
                    />
                    <span className="text-xs text-ink-500">bps</span>
                  </label>
                </div>
              ))}
              <p className="text-xs text-ink-500">
                Current total: {(recipeRows.reduce((sum, line) => sum + line.ratioBps, 0) / 100).toFixed(2)}%
              </p>
              <button
                type="submit"
                className="rounded-lg border border-forest-600 px-4 py-2.5 text-sm font-semibold text-forest-800 hover:bg-forest-50"
              >
                Save composition
              </button>
            </form>
          ) : (
            <p className="text-sm text-ink-500">No recipe is configured for this blend.</p>
          )}
        </section>
      )}
    </div>
  );
}
