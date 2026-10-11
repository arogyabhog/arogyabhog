import { and, count, desc, eq, notInArray, type SQL } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db/client';
import { ingredients, orders, stores } from '@/db/schema';
import { requireStaff } from '@/server/auth';

export const dynamic = 'force-dynamic';

const money = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(paise / 100);
const label = (status: string) => status.replaceAll('_', ' ').toLowerCase();
const dateLabel = (time: number) => new Date(time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export default async function AdminOverview() {
  const staff = await requireStaff();
  const scope = staff.role === 'MANAGER' ? eq(orders.storeId, staff.storeId ?? '') : undefined;
  const scoped = (condition?: SQL) => (scope ? and(scope, condition) : condition);
  const ingredientScope = staff.role === 'MANAGER' ? eq(ingredients.storeId, staff.storeId ?? '') : undefined;
  const needsRateReview = and(ingredientScope, eq(ingredients.ratesProvisional, true), eq(ingredients.active, true));

  const [provisionalResult] = await db.select({ n: count() }).from(ingredients).where(needsRateReview);
  const provisionalRows = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      sellPaisePerKg: ingredients.sellPaisePerKg,
      storeName: stores.name,
      reviewNote: ingredients.reviewNote,
    })
    .from(ingredients)
    .innerJoin(stores, eq(stores.id, ingredients.storeId))
    .where(needsRateReview)
    .orderBy(ingredients.name)
    .limit(6)
    .all();

  const [activeResult] = await db
    .select({ n: count() })
    .from(orders)
    .where(scoped(notInArray(orders.fulfillmentStatus, ['CLOSED', 'CANCELLED'])));
  const [upiResult] = await db
    .select({ n: count() })
    .from(orders)
    .where(scoped(eq(orders.paymentStatus, 'AWAITING_VERIFICATION')));
  const awaiting = await db
    .select({
      id: orders.id,
      customerName: orders.customerName,
      totalPaise: orders.totalPaise,
      placedAt: orders.placedAt,
    })
    .from(orders)
    .where(scoped(eq(orders.paymentStatus, 'AWAITING_VERIFICATION')))
    .orderBy(desc(orders.placedAt))
    .limit(6)
    .all();
  const recent = await db
    .select({
      id: orders.id,
      customerName: orders.customerName,
      totalPaise: orders.totalPaise,
      placedAt: orders.placedAt,
      fulfillmentStatus: orders.fulfillmentStatus,
      paymentStatus: orders.paymentStatus,
      paymentMethod: orders.paymentMethod,
    })
    .from(orders)
    .where(scope)
    .orderBy(desc(orders.placedAt))
    .limit(8)
    .all();

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-forest-700">Operations</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-ink-900">Dashboard</h1>
          <p className="mt-2 text-sm text-ink-500">
            A working view of orders that need attention and what moved most recently.
          </p>
        </div>
        <Link
          href="/admin/orders"
          className="rounded-lg bg-forest-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-800"
        >
          Open order desk
        </Link>
      </section>

      <section aria-label="Order summary" className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/orders"
          className="rounded-card border border-ivory-300 bg-white p-5 shadow-warm transition hover:border-forest-300"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-forest-700">Active orders</p>
          <p className="mt-2 tnum font-display text-3xl font-bold text-ink-900">{activeResult?.n ?? 0}</p>
          <p className="mt-1 text-xs text-ink-500">Placed, processing, or on the way · open queue</p>
        </Link>
        <Link
          href="/admin/orders"
          className="rounded-card border border-ivory-300 bg-white p-5 shadow-warm transition hover:border-forest-300"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-forest-700">UPI claims to verify</p>
          <p className="mt-2 tnum font-display text-3xl font-bold text-ink-900">{upiResult?.n ?? 0}</p>
          <p className="mt-1 text-xs text-ink-500">Customer attested; check the bank statement before confirming</p>
        </Link>
        <Link
          href="/admin/ingredients"
          className="rounded-card border border-ivory-300 bg-white p-5 shadow-warm transition hover:border-forest-300"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-forest-700">Provisional rate sets</p>
          <p className="mt-2 tnum font-display text-3xl font-bold text-ink-900">{provisionalResult?.n ?? 0}</p>
          <p className="mt-1 text-xs text-ink-500">Review individual ingredient prices</p>
        </Link>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="overflow-hidden rounded-card border border-ivory-300 bg-white shadow-warm">
          <div className="flex items-center justify-between gap-3 border-b border-ivory-200 bg-ivory-50 px-5 py-4">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink-900">Needs payment review</h2>
              <p className="mt-1 text-xs text-ink-500">
                Confirm UPI only after matching the transfer in your bank app.
              </p>
            </div>
            <Link href="/admin/orders" className="shrink-0 text-xs font-bold text-forest-700 hover:underline">
              All orders
            </Link>
          </div>
          {awaiting.length ? (
            <ul className="divide-y divide-ivory-200">
              {awaiting.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900">{order.customerName}</p>
                    <p className="mt-1 truncate font-mono text-xs text-ink-500">
                      {order.id} · {dateLabel(order.placedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="tnum font-semibold text-ink-900">{money(order.totalPaise)}</p>
                    <Link
                      href="/admin/orders"
                      aria-label={`Review payment for order ${order.id}`}
                      className="rounded-lg border border-forest-600 px-3 py-2 text-xs font-bold text-forest-700 hover:bg-forest-50"
                    >
                      Review
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-ink-500">No UPI claims are waiting for review.</p>
          )}
        </div>

        <div className="overflow-hidden rounded-card border border-ivory-300 bg-white shadow-warm">
          <div className="flex items-center justify-between border-b border-ivory-200 bg-ivory-50 px-5 py-4">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink-900">Recent orders</h2>
              <p className="mt-1 text-xs text-ink-500">
                Latest eight · {staff.role === 'ADMIN' ? 'all stores' : 'your store only'}
              </p>
            </div>
            <Link href="/admin/orders" className="text-xs font-bold text-forest-700 hover:underline">
              View queue
            </Link>
          </div>
          {recent.length ? (
            <ul className="divide-y divide-ivory-200">
              {recent.map((order) => (
                <li key={order.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-900">{order.customerName}</p>
                      <p className="mt-1 truncate font-mono text-xs text-ink-500">
                        {order.id} · {dateLabel(order.placedAt)}
                      </p>
                    </div>
                    <p className="tnum whitespace-nowrap font-semibold text-ink-900">{money(order.totalPaise)}</p>
                  </div>
                  <p className="mt-2 text-xs capitalize text-ink-500">
                    {label(order.fulfillmentStatus)} · {order.paymentMethod === 'UPI_QR' ? 'UPI' : 'COD'}{' '}
                    {label(order.paymentStatus)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-ink-500">
              No orders yet. New customer orders will appear here.
            </p>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-card border border-amber-200 bg-white shadow-warm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100 bg-amber-50 px-5 py-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink-900">Ingredient rates to review</h2>
            <p className="mt-1 text-xs text-ink-500">
              Provisional rates are excluded from confidence in recipe price checks.
            </p>
          </div>
          <Link href="/admin/ingredients" className="text-xs font-bold text-forest-700 hover:underline">
            Manage rates
          </Link>
        </div>
        {provisionalRows.length ? (
          <ul className="divide-y divide-ivory-200">
            {provisionalRows.map((ingredient) => (
              <li key={ingredient.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="font-semibold text-ink-900">{ingredient.name}</p>
                  <p className="mt-1 text-xs text-ink-500">
                    {staff.role === 'ADMIN' ? `${ingredient.storeName} · ` : ''}
                    {ingredient.reviewNote ?? 'Rate requires verification'}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="tnum text-sm text-ink-700">{money(ingredient.sellPaisePerKg)}/kg</span>
                  <Link
                    href="/admin/ingredients"
                    className="rounded-lg border border-forest-600 px-3 py-2 text-xs font-bold text-forest-700 hover:bg-forest-50"
                  >
                    Review
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-center text-sm text-ink-500">No active ingredient rates need review.</p>
        )}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-forest-100 bg-forest-50 px-5 py-4">
        <div>
          <h2 className="font-semibold text-forest-900">Need the change history?</h2>
          <p className="mt-1 text-sm text-ink-600">Staff actions and order changes are recorded in the audit trail.</p>
        </div>
        <Link
          href="/admin/audit"
          className="rounded-lg border border-forest-700 px-4 py-2 text-sm font-semibold text-forest-800 hover:bg-white"
        >
          Open audit log
        </Link>
      </section>
    </div>
  );
}
