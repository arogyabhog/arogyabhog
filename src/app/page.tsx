import { eq } from 'drizzle-orm';
import { type IngProp, LabClient, type PreMadeProp } from '@/components/LabClient';
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

export const dynamic = 'force-dynamic';

export default async function Home() {
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

  const ingProps: IngProp[] = ings.map((i) => ({ ...i, hasNutrition: withNutrition.has(i.id) }));

  const preMades: PreMadeProp[] = prods.map((p) => {
    const v = variants.find((x) => x.productId === p.id && x.packSizeG === 10000);
    const pls = lines.filter((l) => l.productId === p.id);
    const named = pls
      .map((l) => ({
        name: ings.find((i) => i.id === l.ingredientId)?.name ?? l.ingredientId,
        bps: l.ratioBps,
        id: l.ingredientId,
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

  const everyday = preMades.find((p) => p.slug === 'everyday-atta');

  return (
    <main>
      {/* HERO — one forest-free, ivory-first statement; the jewel gradient stays in the logo */}
      <section className="relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/img/hero-grains.png"
          alt="Brass bowls of whole grains and fresh-milled flour on ivory linen"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ivory-50 via-ivory-50/85 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-5 py-24 sm:py-32">
          <div className="max-w-xl">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-gold-700">
              Kanpur · milled weekly · delivered by our own drivers
            </div>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.1] tracking-tight text-ink-900 sm:text-6xl">
              Flour you can read, line by line.
            </h1>
            <p className="mt-3 font-hindi text-xl text-ink-500">रोटी में स्वाद, स्वास्थ्य के साथ</p>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-ink-700">
              Every blend shows its exact grain percentages, its full price breakdown and its estimated nutrition —
              because transparency is not a campaign, it is the recipe.
            </p>
            <div className="mt-8 flex gap-3">
              <a
                href="#lab"
                className="rounded-ctrl bg-ink-900 px-6 py-3 text-sm font-bold text-gold-300 shadow-warm hover:bg-ink-800"
              >
                Build my atta
              </a>
              <a
                href="#premade"
                className="rounded-ctrl border border-gold-500 px-6 py-3 text-sm font-bold text-gold-700 hover:bg-gold-100"
              >
                View premade mixes
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* PREMADE — exact % disclosure on every card (research L1) */}
      <section id="premade" className="mx-auto max-w-6xl px-5 pt-20">
        <div className="text-xs font-bold uppercase tracking-[0.14em] text-gold-700">The house blends</div>
        <h2 className="mt-2 font-display text-3xl font-semibold text-ink-900">
          Premade, and proud of their percentages
        </h2>
        <div className="gold-rule mt-4 mb-8" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {preMades.map((p) => (
            <article key={p.slug} className="overflow-hidden rounded-card border border-ivory-300 bg-white shadow-warm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.img} alt={p.name} className="aspect-[4/3] w-full object-cover" />
              <div className="p-5">
                <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-gold-600">Premade · 10 kg</div>
                <h3 className="mt-1 font-display text-xl font-semibold text-ink-900">{p.name}</h3>
                <ul className="mt-3 space-y-1 text-[13px] text-ink-500">
                  {p.lines.slice(0, 3).map((l) => (
                    <li key={l.name} className="flex justify-between">
                      <span>{l.name}</span>
                      <span className="tnum font-semibold text-ink-700">{(l.bps / 100).toFixed(1)}%</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-baseline justify-between">
                  <div className="tnum text-xl font-extrabold text-ink-900">
                    ₹{(p.sellPaise / 100).toLocaleString('en-IN')}
                    <span className="ml-1 text-xs font-medium text-ink-400">/ 10 kg</span>
                  </div>
                  {p.provisional && (
                    <span className="rounded-full bg-warn-soft px-2 py-1 text-[10px] font-bold text-warn">
                      indicative
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <LabClient
        storeId={SEED_STORE_ID}
        packs={[5000, 10000, 15000, 20000]}
        ingredients={ingProps}
        preMades={preMades}
        template={everyday?.template ?? []}
      />
    </main>
  );
}
