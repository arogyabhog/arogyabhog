import { asc, eq, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db/client';
import { products, productVariants } from '@/db/schema';
import { requireStaff } from '@/server/auth';

export const dynamic = 'force-dynamic';

const money = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(paise / 100);

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const staff = await requireStaff();
  const { notice } = await searchParams;
  const predicate = staff.role === 'MANAGER' ? eq(products.storeId, staff.storeId ?? '') : undefined;
  const rows = await db.select().from(products).where(predicate).orderBy(asc(products.name)).all();
  const variants = rows.length
    ? await db
        .select()
        .from(productVariants)
        .where(
          inArray(
            productVariants.productId,
            rows.map((product) => product.id),
          ),
        )
        .all()
    : [];
  const variantsByProduct = new Map<string, typeof variants>();
  for (const variant of variants) {
    const list = variantsByProduct.get(variant.productId) ?? [];
    list.push(variant);
    variantsByProduct.set(variant.productId, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-forest-700">Catalog</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-ink-900">Products</h1>
          <p className="mt-2 text-sm text-ink-500">
            Every blend and single-grain product, with its own pack prices and status.
          </p>
        </div>
        <p className="text-sm text-ink-500">
          {rows.length} products · {staff.role === 'ADMIN' ? 'all stores' : 'your store'}
        </p>
      </div>

      {notice === 'saved' && (
        <p role="status" className="rounded-lg border border-forest-100 bg-forest-50 px-4 py-3 text-sm text-forest-800">
          Product details saved and audited.
        </p>
      )}
      {notice === 'invalid' && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Some values were invalid. Review the fields and try again.
        </p>
      )}
      {notice === 'unavailable' && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          That product is unavailable for this account.
        </p>
      )}

      {rows.length ? (
        <div className="overflow-x-auto rounded-card border border-ivory-300 bg-white shadow-warm">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-forest-900 text-left text-xs uppercase tracking-wide text-gold-200">
              <tr>
                <th className="px-5 py-3 font-bold">Product</th>
                <th className="px-5 py-3 font-bold">Kind</th>
                <th className="px-5 py-3 font-bold">Pack prices</th>
                <th className="px-5 py-3 font-bold">Status</th>
                <th className="px-5 py-3 font-bold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((product) => {
                const packVariants = [...(variantsByProduct.get(product.id) ?? [])].sort(
                  (a, b) => a.packSizeG - b.packSizeG,
                );
                return (
                  <tr key={product.id} className="border-b border-ivory-200 last:border-b-0">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-ink-900">{product.name}</p>
                      <p className="mt-1 font-mono text-xs text-ink-500">/{product.slug}</p>
                    </td>
                    <td className="px-5 py-4 capitalize text-ink-600">
                      {product.kind === 'single' ? 'Single grain' : 'House blend'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {packVariants.map((variant) => (
                          <span key={`${variant.packSizeG}`} className="tnum whitespace-nowrap text-ink-700">
                            {variant.packSizeG / 1000} kg {money(variant.sellPaise)}
                            {variant.provisional && (
                              <span className="ml-1 text-[10px] text-bronze-700">indicative</span>
                            )}
                          </span>
                        ))}
                        {!packVariants.length && <span className="text-ink-400">No pack variants</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={
                          product.status === 'active'
                            ? 'rounded-full bg-forest-50 px-2.5 py-1 text-xs font-semibold text-forest-800'
                            : 'rounded-full bg-ivory-200 px-2.5 py-1 text-xs font-semibold text-ink-600'
                        }
                      >
                        {product.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="rounded-lg border border-forest-600 px-3 py-2 text-xs font-bold text-forest-700 hover:bg-forest-50"
                      >
                        Edit item
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-card border border-ivory-300 bg-white p-8 text-center shadow-warm">
          <p className="font-display text-xl font-semibold text-ink-900">No products in this store</p>
          <p className="mt-2 text-sm text-ink-500">
            Products must be seeded or created before they can be managed here.
          </p>
        </div>
      )}
    </div>
  );
}
