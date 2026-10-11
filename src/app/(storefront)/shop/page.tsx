import { ProductCard } from '@/components/ProductCard';
import { getStorefront } from '@/server/storefront-data';

export const dynamic = 'force-dynamic';

export default async function ShopPage() {
  const { preMades, singles } = await getStorefront();
  return (
    <main className="mx-auto max-w-6xl px-4 pt-12 sm:px-6 sm:pt-16">
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-[0.14em] text-forest-700">Shop</div>
        <h1 className="font-display text-3xl font-semibold text-ink-900 sm:text-4xl">Everything we mill</h1>
        <p className="max-w-2xl text-base leading-7 text-ink-700">
          Single-grain flours first, then the house blends. Prices are GST-inclusive; delivery (₹50/order) and any
          custom-mix milling charges appear separately at checkout.
        </p>
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-semibold text-ink-900">Single-grain flours</h2>
          <span className="text-sm text-ink-500">Milled whole, nothing added</span>
        </div>
        <div className="gold-rule mt-4" />
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {singles.map((p) => (
            <ProductCard key={p.slug} p={p} />
          ))}
        </div>
      </section>

      <section className="mt-14 pb-16 sm:mt-16 sm:pb-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-semibold text-ink-900">House blends</h2>
          <span className="text-sm text-ink-500">Locked recipes, exact percentages disclosed</span>
        </div>
        <div className="gold-rule mt-4" />
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {preMades.map((p) => (
            <ProductCard key={p.slug} p={p} />
          ))}
        </div>
      </section>
    </main>
  );
}
