import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { orderEvents, orders, stores } from '@/db/schema';
import { FULFILLMENT_TRANSITIONS, PAYMENT_TRANSITIONS } from '@/domain/order-engine';
import { requireStaff } from '@/server/auth';
import { updateFulfillment, updatePayment } from './actions';

export const dynamic = 'force-dynamic';

const money = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(paise / 100);
const pretty = (status: string) => status.replaceAll('_', ' ').toLowerCase();

function snapshotLines(value: string): Array<{ name: string; displayPercent: string; linePaise: number }> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || !('lines' in parsed) || !Array.isArray(parsed.lines)) return [];
    return parsed.lines.filter(
      (line): line is { name: string; displayPercent: string; linePaise: number } =>
        !!line &&
        typeof line === 'object' &&
        'name' in line &&
        typeof line.name === 'string' &&
        'displayPercent' in line &&
        typeof line.displayPercent === 'string' &&
        'linePaise' in line &&
        typeof line.linePaise === 'number' &&
        Number.isSafeInteger(line.linePaise),
    );
  } catch {
    return [];
  }
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const staff = await requireStaff();
  const { notice } = await searchParams;
  const predicates = staff.role === 'MANAGER' ? [eq(orders.storeId, staff.storeId ?? '')] : [];
  const rows = await db
    .select({ order: orders, storeName: stores.name })
    .from(orders)
    .innerJoin(stores, eq(stores.id, orders.storeId))
    .where(predicates.length ? and(...predicates) : undefined)
    .orderBy(desc(orders.placedAt))
    .limit(50)
    .all();
  const eventRows = rows.length
    ? await db
        .select({
          orderId: orderEvents.orderId,
          note: orderEvents.note,
          action: orderEvents.action,
          at: orderEvents.at,
        })
        .from(orderEvents)
        .where(
          inArray(
            orderEvents.orderId,
            rows.map(({ order }) => order.id),
          ),
        )
        .orderBy(desc(orderEvents.at))
        .all()
    : [];
  const latestEventByOrder = new Map<string, (typeof eventRows)[number]>();
  for (const event of eventRows) {
    if (!latestEventByOrder.has(event.orderId)) latestEventByOrder.set(event.orderId, event);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-forest-700">Fulfilment desk</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-ink-900">Orders</h2>
        </div>
        <p className="text-sm text-ink-500">Latest 50 · {staff.role === 'ADMIN' ? 'all stores' : 'your store'}</p>
      </div>

      {notice === 'updated' && (
        <p
          role="status"
          className="rounded-card border border-forest-100 bg-forest-50 px-4 py-3 text-sm text-forest-800"
        >
          Order updated. The timeline and audit log were recorded.
        </p>
      )}
      {notice === 'transition-failed' && (
        <p role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          That status change is not allowed from the current state. Refresh the page and try again.
        </p>
      )}
      {notice === 'unavailable' && (
        <p role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          The requested order or action is unavailable for this account.
        </p>
      )}

      {rows.length === 0 ? (
        <div className="rounded-card border border-ivory-300 bg-white p-8 text-center shadow-warm">
          <h3 className="font-display text-xl font-semibold text-ink-900">No orders yet</h3>
          <p className="mt-2 text-sm text-ink-500">New customer orders will appear here.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {rows.map(({ order, storeName }) => {
            const fulfillmentTargets =
              FULFILLMENT_TRANSITIONS[order.fulfillmentStatus as keyof typeof FULFILLMENT_TRANSITIONS] ?? [];
            // AWAITING_VERIFICATION is a customer attestation, never a staff-set state.
            const paymentTargets = (
              PAYMENT_TRANSITIONS[order.paymentStatus as keyof typeof PAYMENT_TRANSITIONS] ?? []
            ).filter((target) => target !== 'AWAITING_VERIFICATION');
            const lines = snapshotLines(order.itemsSnapshot);
            const latestEvent = latestEventByOrder.get(order.id);
            return (
              <article
                key={order.id}
                className="overflow-hidden rounded-card border border-ivory-300 bg-white shadow-warm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ivory-200 bg-ivory-50 px-5 py-4 sm:px-6">
                  <div>
                    <p className="font-mono text-xs font-semibold text-ink-500">{order.id}</p>
                    <h3 className="mt-1 font-display text-xl font-semibold text-ink-900">{order.customerName}</h3>
                    <p className="mt-1 text-sm text-ink-600">
                      {storeName} · {order.kind} · {order.packSizeG / 1000} kg × {order.packageCount}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tnum font-display text-2xl font-bold text-ink-900">{money(order.totalPaise)}</p>
                    <p className="mt-1 text-xs text-ink-500">
                      Placed {new Date(order.placedAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 px-5 py-5 sm:px-6 lg:grid-cols-[1fr_1fr]">
                  <section aria-label={`Customer and items for ${order.id}`} className="space-y-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-forest-700">Delivery details</p>
                      <p className="mt-2 text-sm font-semibold text-ink-900">{order.customerPhone}</p>
                      <p className="mt-1 text-sm leading-6 text-ink-700">
                        {order.addressLine}, {order.city} · {order.pincode}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-forest-700">Order contents</p>
                      <ul className="mt-2 space-y-1 text-sm text-ink-700">
                        {lines.map((line, index) => (
                          <li key={`${line.name}-${index}`} className="flex justify-between gap-4">
                            <span>
                              {line.name} <span className="text-ink-500">({line.displayPercent})</span>
                            </span>
                            <span className="tnum whitespace-nowrap">{money(line.linePaise)}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-xs text-ink-500">
                        {order.paymentMethod === 'UPI_QR' ? 'UPI transfer' : 'Cash on delivery'} · payment{' '}
                        {pretty(order.paymentStatus)}
                      </p>
                      {latestEvent?.note && (
                        <p className="mt-2 text-xs text-ink-500">Latest note: {latestEvent.note}</p>
                      )}
                    </div>
                  </section>

                  <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-forest-700">
                        Fulfilment · {pretty(order.fulfillmentStatus)}
                      </p>
                      {fulfillmentTargets.length ? (
                        <form action={updateFulfillment} className="space-y-2">
                          <input type="hidden" name="orderId" value={order.id} />
                          <label className="sr-only" htmlFor={`fulfil-${order.id}`}>
                            Next fulfilment status
                          </label>
                          <select
                            id={`fulfil-${order.id}`}
                            name="to"
                            className="w-full rounded-lg border border-ivory-300 bg-white px-3 py-2 text-sm text-ink-900"
                          >
                            {fulfillmentTargets.map((target) => (
                              <option key={target} value={target}>
                                {pretty(target)}
                              </option>
                            ))}
                          </select>
                          <label className="sr-only" htmlFor={`fulfil-note-${order.id}`}>
                            Optional fulfilment note
                          </label>
                          <input
                            id={`fulfil-note-${order.id}`}
                            name="note"
                            maxLength={300}
                            placeholder="Optional note"
                            className="w-full rounded-lg border border-ivory-300 px-3 py-2 text-sm"
                          />
                          <button
                            className="w-full rounded-lg bg-forest-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700"
                            type="submit"
                          >
                            Update fulfilment
                          </button>
                        </form>
                      ) : (
                        <p className="text-sm text-ink-500">No further fulfilment changes.</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-forest-700">
                        Payment · {pretty(order.paymentStatus)}
                      </p>
                      {paymentTargets.length ? (
                        <form action={updatePayment} className="space-y-2">
                          <input type="hidden" name="orderId" value={order.id} />
                          <label className="sr-only" htmlFor={`payment-${order.id}`}>
                            Payment action
                          </label>
                          <select
                            id={`payment-${order.id}`}
                            name="to"
                            className="w-full rounded-lg border border-ivory-300 bg-white px-3 py-2 text-sm text-ink-900"
                          >
                            {paymentTargets.map((target) => (
                              <option key={target} value={target}>
                                {target === 'PAID' ? 'Confirm received' : 'Reject claim — return to unpaid'}
                              </option>
                            ))}
                          </select>
                          <label className="sr-only" htmlFor={`payment-note-${order.id}`}>
                            Optional payment note
                          </label>
                          <input
                            id={`payment-note-${order.id}`}
                            name="note"
                            maxLength={300}
                            placeholder="Optional reference / note"
                            className="w-full rounded-lg border border-ivory-300 px-3 py-2 text-sm"
                          />
                          <button
                            className="w-full rounded-lg bg-forest-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700"
                            type="submit"
                          >
                            Update payment
                          </button>
                        </form>
                      ) : (
                        <p className="text-sm text-ink-500">No further payment changes.</p>
                      )}
                    </div>
                  </section>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
