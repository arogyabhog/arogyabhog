import { getStorefront } from '@/server/storefront-data';

export const dynamic = 'force-dynamic';

const FEATURED = ['everyday-atta', 'sugar-care-atta', 'high-protein-atta'];

export default async function Home() {
  const { preMades } = await getStorefront();
  const featured = FEATURED.map((s) => preMades.find((p) => p.slug === s)).filter((p) => p !== undefined);

  return (
    <main>
      {/* HERO */}
      <section className="relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/img/hero-grains.png"
          alt="Brass bowls of whole grains and fresh-milled flour on ivory linen"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-ivory-50/90 sm:bg-gradient-to-r sm:from-ivory-50 sm:via-ivory-50/85 sm:to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-5 sm:py-24 lg:py-32">
          <div className="max-w-xl">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-gold-700">
              Kanpur · milled weekly · delivered by our own drivers
            </div>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink-900 sm:text-5xl lg:text-6xl">
              Flour you can read, line by line.
            </h1>
            <p className="mt-3 font-hindi text-xl text-ink-500">रोटी में स्वाद, स्वास्थ्य के साथ</p>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-ink-700">
              Every blend shows its exact grain percentages, its full price breakdown and its estimated nutrition —
              because transparency is not a campaign, it is the recipe.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/lab"
                className="rounded-ctrl bg-forest-800 px-6 py-3 text-sm font-bold text-gold-100 shadow-warm hover:bg-forest-700"
              >
                Build my atta
              </a>
              <a
                href="/shop"
                className="rounded-ctrl border border-gold-500 px-6 py-3 text-sm font-bold text-gold-700 hover:bg-gold-100"
              >
                Shop the blends
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* PROMISE STRIP */}
      <section id="promise" className="border-y border-forest-900 bg-forest-950">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-3 sm:px-5">
          <div>
            <div className="text-sm font-extrabold text-gold-200">Our own drivers</div>
            <p className="mt-1 text-[13px] leading-6 text-forest-100/90">
              No courier roulette. Fresh packs travel in our bags, with people we employ.
            </p>
          </div>
          <div>
            <div className="text-sm font-extrabold text-gold-200">COD &amp; UPI QR — no middleman</div>
            <p className="mt-1 text-[13px] leading-6 text-forest-100/90">
              Pay cash on delivery or scan our QR. Your money reaches us directly, never a gateway.
            </p>
          </div>
          <div>
            <div className="text-sm font-extrabold text-gold-200">The receipt is the recipe</div>
            <p className="mt-1 text-[13px] leading-6 text-forest-100/90">
              Exact percentages, every fee on its own line, GST split shown. Estimated nutrition, labelled so.
            </p>
          </div>
        </div>
      </section>

      {/* FEATURED BLENDS */}
      <section className="mx-auto max-w-6xl px-4 pt-14 sm:px-5 sm:pt-16">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-gold-700">The house blends</div>
            <h2 className="mt-2 font-display text-2xl font-semibold text-ink-900 sm:text-3xl">
              Premade, and proud of their percentages
            </h2>
          </div>
          <a href="/shop" className="text-sm font-bold text-gold-700 hover:underline">
            All five →
          </a>
        </div>
        <div className="gold-rule mt-4 mb-8" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p) => (
            <a
              key={p.slug}
              href={`/shop/${p.slug}`}
              className="group overflow-hidden rounded-card border border-ivory-300 bg-white shadow-warm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.img}
                alt={p.name}
                className="aspect-[4/3] w-full object-cover transition group-hover:scale-[1.02]"
              />
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
                    <span className="ml-1 text-xs font-medium text-ink-500">/ 10 kg</span>
                  </div>
                  {p.provisional && (
                    <span className="rounded-full bg-warn-soft px-2 py-1 text-[10px] font-bold text-warn">
                      indicative
                    </span>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* THE LAB CTA — the one deliberate forest-green moment (ADR-025) */}
      <section className="mx-auto mt-16 max-w-6xl px-4 sm:mt-20 sm:px-5">
        <div className="overflow-hidden rounded-card bg-forest-900 px-6 py-10 sm:px-12 sm:py-12">
          <div className="flex flex-wrap items-center gap-8">
            <div className="min-w-[280px] flex-1">
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-forest-100/70">The Lab</div>
              <h2 className="mt-2 font-display text-3xl font-semibold text-gold-200">
                Don&rsquo;t like our recipe? Write your own.
              </h2>
              <p className="mt-3 max-w-lg text-[15px] leading-7 text-forest-100/85">
                Eighteen ingredients, your grams, our guardrails. Watch the price build rupee by rupee and the nutrition
                table fill in as you slide — then order exactly that.
              </p>
            </div>
            <a
              href="/lab"
              className="rounded-ctrl bg-gold-300 px-8 py-4 text-sm font-extrabold text-forest-950 shadow-warm hover:bg-gold-200"
            >
              Open the Lab →
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
