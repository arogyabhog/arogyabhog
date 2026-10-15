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
      <section className="mt-8 grid gap-4 rounded-card border border-gold-400 bg-white p-5 shadow-warm sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-forest-700">Share ArogyaBhog</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-ink-900">
            Your referral code: <span className="tnum text-forest-800">{user.referralCode}</span>
          </h2>
          <p className="mt-1 text-sm text-ink-600">
            Friends who join with your code start with two delivery credits. Earn one more after their first delivered
            order, subject to the store cap.
          </p>
          <a
            href={`/register?ref=${encodeURIComponent(user.referralCode)}`}
            className="mt-2 inline-block text-sm font-bold text-forest-700 hover:underline"
          >
            Share sign-up link →
          </a>
        </div>
        <div className="rounded-xl bg-forest-50 px-5 py-4 text-center">
          <div className="tnum font-display text-3xl font-bold text-forest-900">{user.freeDeliveryCredits}</div>
          <div className="text-xs font-semibold text-forest-800">delivery credits</div>
        </div>
      </section>
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
