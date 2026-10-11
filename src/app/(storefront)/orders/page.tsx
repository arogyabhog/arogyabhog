import { desc, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { CartClearer } from '@/components/CartClearer';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import { getCurrentUser } from '@/server/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your orders · ArogyaBhog' };

const inr = (p: number) => `₹${(p / 100).toLocaleString('en-IN')}`;

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const mine = await db.select().from(orders).where(eq(orders.userId, user.id)).orderBy(desc(orders.placedAt));
  return (
    <main className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
      <CartClearer />
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-[0.14em] text-forest-700">Your orders</div>
        <h1 className="font-display text-3xl font-semibold text-ink-900">Every pack, tracked</h1>
      </div>
      <div className="gold-rule mt-6" />
      <div className="mt-8 space-y-4 pb-16">
        {mine.length === 0 && (
          <div className="rounded-card border border-ivory-300 bg-white p-10 text-center shadow-warm">
            <p className="text-base text-ink-700">No orders yet.</p>
            <a href="/shop" className="mt-2 inline-block text-sm font-bold text-forest-700 hover:underline">
              Browse the shop →
            </a>
          </div>
        )}
        {mine.map((o) => (
          <a
            key={o.id}
            href={`/orders/${o.id}`}
            className="flex flex-wrap items-center gap-4 rounded-card border border-ivory-300 bg-white p-5 shadow-warm transition hover:border-gold-400"
          >
            <div className="min-w-0 flex-1">
              <div className="tnum text-sm font-bold text-ink-900">{o.id}</div>
              <div className="text-xs text-ink-500">
                {new Date(o.placedAt).toLocaleString('en-IN')} · {o.kind === 'LAB' ? 'Custom mix' : 'House product'} ·{' '}
                {(o.packSizeG * o.packageCount) / 1000} kg
              </div>
            </div>
            <span className="rounded-full bg-ivory-100 px-2.5 py-1 text-[11px] font-bold text-ink-700">
              {o.fulfillmentStatus}
            </span>
            <span className="rounded-full bg-ivory-100 px-2.5 py-1 text-[11px] font-bold text-ink-700">
              {o.paymentStatus}
            </span>
            <span className="tnum text-sm font-extrabold text-ink-900">{inr(o.totalPaise)}</span>
          </a>
        ))}
      </div>
    </main>
  );
}
