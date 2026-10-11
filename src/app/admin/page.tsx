import { count } from 'drizzle-orm';
import { db } from '@/db/client';
import { auditLog, ingredients, orders, products } from '@/db/schema';

export const dynamic = 'force-dynamic';

export default async function AdminOverview() {
  const [p] = await db.select({ n: count() }).from(products);
  const [i] = await db.select({ n: count() }).from(ingredients);
  const [o] = await db.select({ n: count() }).from(orders);
  const [a] = await db.select({ n: count() }).from(auditLog);
  const cards = [
    ['Products', p?.n ?? 0, 'premade blends + single-grain flours'],
    ['Ingredients', i?.n ?? 0, 'Lab catalogue with rates & nutrition'],
    ['Orders', o?.n ?? 0, 'fulfilment + payment state machines'],
    ['Audit entries', a?.n ?? 0, 'every staff action, exportable'],
  ] as const;
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(([label, n, note]) => (
        <div key={label} className="space-y-2 rounded-card border border-ivory-300 bg-white p-6 shadow-warm">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-forest-700">{label}</div>
          <div className="tnum font-display text-4xl font-bold text-ink-900">{n}</div>
          <div className="text-xs text-ink-500">{note}</div>
        </div>
      ))}
      <div className="space-y-2 rounded-card border border-forest-100 bg-forest-50 p-6 sm:col-span-2 lg:col-span-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-forest-800">Next mechanisms</div>
        <p className="text-sm leading-6 text-ink-700">
          Per-pack re-pricing, product renaming (ADR-020), fee edits and the checkout flow land on top of this session
          layer — every one of them will write to the audit log automatically.
        </p>
      </div>
    </div>
  );
}
