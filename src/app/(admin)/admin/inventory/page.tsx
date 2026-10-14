import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { ingredients, inventoryMovements, stores, users } from '@/db/schema';
import { getCurrentUser } from '@/server/auth';
import { recordInventoryMovement } from './actions';

export const dynamic = 'force-dynamic';

const fieldClass =
  'mt-1.5 w-full rounded-ctrl border border-ivory-300 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-forest-600 focus:outline-none';
const labelClass = 'block text-sm font-semibold text-ink-800';
const gramsLabel = (grams: number) =>
  `${grams.toLocaleString('en-IN')} g (${(grams / 1000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg)`;
const timeLabel = (time: number) => new Date(time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string; notice?: string }>;
}) {
  const staff = await getCurrentUser();
  if (!staff || (staff.role !== 'ADMIN' && staff.role !== 'MANAGER')) redirect('/login');
  const params = await searchParams;
  const allStores = await db.select().from(stores).orderBy(asc(stores.name)).all();
  const availableStores = staff.role === 'ADMIN' ? allStores : allStores.filter((store) => store.id === staff.storeId);
  const requestedStore = staff.role === 'ADMIN' ? params.storeId : (staff.storeId ?? undefined);
  const selected = availableStores.find((store) => store.id === requestedStore) ?? availableStores[0];
  const notice = params.notice;

  let balances: Array<{ ingredientId: string; name: string; currentGrams: number }> = [];
  let recent: Array<{
    id: number;
    ingredientName: string;
    deltaG: number;
    reason: string;
    orderId: string | null;
    note: string | null;
    createdAt: number;
    actorName: string | null;
    actorEmail: string | null;
  }> = [];
  if (selected) {
    balances = await db
      .select({
        ingredientId: ingredients.id,
        name: ingredients.name,
        currentGrams: sql<number>`coalesce(sum(${inventoryMovements.deltaG}), 0)`,
      })
      .from(ingredients)
      .leftJoin(
        inventoryMovements,
        and(eq(inventoryMovements.storeId, ingredients.storeId), eq(inventoryMovements.ingredientId, ingredients.id)),
      )
      .where(eq(ingredients.storeId, selected.id))
      .groupBy(ingredients.id)
      .orderBy(asc(ingredients.name))
      .all();

    recent = await db
      .select({
        id: inventoryMovements.id,
        ingredientName: ingredients.name,
        deltaG: inventoryMovements.deltaG,
        reason: inventoryMovements.reason,
        orderId: inventoryMovements.orderId,
        note: inventoryMovements.note,
        createdAt: inventoryMovements.createdAt,
        actorName: users.displayName,
        actorEmail: users.email,
      })
      .from(inventoryMovements)
      .innerJoin(ingredients, eq(ingredients.id, inventoryMovements.ingredientId))
      .leftJoin(users, eq(users.id, inventoryMovements.actorUserId))
      .where(eq(inventoryMovements.storeId, selected.id))
      .orderBy(desc(inventoryMovements.createdAt), desc(inventoryMovements.id))
      .limit(60)
      .all();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-forest-700">Operations</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink-900">Raw ingredient inventory</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-500">
          Stock is the sum of an append-only movement ledger. Orders reserve recipe grams when placed; eligible
          cancellations append a return movement.
        </p>
      </header>

      {staff.role === 'ADMIN' && availableStores.length > 0 && (
        <form
          method="get"
          className="flex flex-wrap items-end gap-3 rounded-card border border-ivory-300 bg-white p-4 shadow-warm"
        >
          <label className={`${labelClass} min-w-56 flex-1`}>
            Store
            <select name="storeId" defaultValue={selected?.id} className={fieldClass}>
              {availableStores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name} · {store.city}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-ctrl bg-forest-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-forest-700"
          >
            Select store
          </button>
        </form>
      )}

      {!selected ? (
        <div className="rounded-card border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          {staff.role === 'MANAGER' ? 'No store is assigned to this manager account.' : 'No stores are configured yet.'}
        </div>
      ) : (
        <>
          {notice && (
            <p
              role="status"
              className={`rounded-ctrl px-4 py-3 text-sm font-semibold ${notice === 'saved' ? 'bg-forest-50 text-forest-900' : 'bg-danger-soft text-danger'}`}
            >
              {notice === 'saved'
                ? 'Inventory movement recorded and audited.'
                : notice === 'invalid'
                  ? 'Movement details are invalid. Check the signed gram amount and required note.'
                  : notice === 'unavailable'
                    ? 'That ingredient or store is unavailable to your account.'
                    : 'Movement could not be recorded. Please retry.'}
            </p>
          )}

          <section className="rounded-card border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            No physical opening stock is assumed. Record a verified count as an <strong>Adjustment</strong> before
            relying on these balances. Negative balances indicate stock usage exceeds recorded receipts/counts; order
            placement is not blocked by an incomplete ledger.
          </section>

          <section className="overflow-hidden rounded-card border border-ivory-300 bg-white shadow-warm">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ivory-200 bg-ivory-50 px-5 py-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-ink-900">On hand · {selected.name}</h2>
                <p className="mt-1 text-xs text-ink-500">Derived by summing every movement, in grams.</p>
              </div>
              <span className="rounded-full bg-forest-100 px-3 py-1 text-xs font-bold text-forest-900">
                {balances.length} ingredients
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-left text-sm">
                <thead className="bg-forest-900 text-xs uppercase tracking-wider text-gold-100">
                  <tr>
                    <th className="px-5 py-3">Ingredient</th>
                    <th className="px-5 py-3">Balance</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ivory-200">
                  {balances.map((row) => (
                    <tr key={row.ingredientId}>
                      <th scope="row" className="px-5 py-3 font-semibold text-ink-900">
                        {row.name}
                      </th>
                      <td className="px-5 py-3 font-mono text-ink-700">{gramsLabel(row.currentGrams)}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.currentGrams < 0 ? 'bg-danger-soft text-danger' : row.currentGrams === 0 ? 'bg-amber-100 text-amber-900' : 'bg-forest-50 text-forest-800'}`}
                        >
                          {row.currentGrams < 0
                            ? 'Below recorded stock'
                            : row.currentGrams === 0
                              ? 'No stock recorded'
                              : 'In stock'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-card border border-ivory-300 bg-white p-5 shadow-warm sm:p-6">
            <h2 className="font-display text-xl font-semibold text-ink-900">Record a stock movement</h2>
            <p className="mt-1 text-xs text-ink-500">
              Purchase is positive grams; wastage is negative; adjustment accepts either sign. Every entry is permanent
              and audited.
            </p>
            <form action={recordInventoryMovement} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <input type="hidden" name="storeId" value={selected.id} />
              <label className={`${labelClass} lg:col-span-2`}>
                Ingredient
                <select name="ingredientId" required className={fieldClass}>
                  {balances.map((row) => (
                    <option key={row.ingredientId} value={row.ingredientId}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Reason
                <select name="reason" required className={fieldClass}>
                  <option value="PURCHASE">Purchase / received</option>
                  <option value="WASTAGE">Wastage</option>
                  <option value="ADJUSTMENT">Stock count adjustment</option>
                </select>
              </label>
              <label className={labelClass}>
                Signed amount · g
                <input
                  className={fieldClass}
                  name="deltaG"
                  type="number"
                  required
                  min={-10000000}
                  max={10000000}
                  step={1}
                  placeholder="+12000 or -250"
                />
              </label>
              <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>
                Reason / reference note
                <input
                  className={fieldClass}
                  name="note"
                  required
                  minLength={2}
                  maxLength={300}
                  placeholder="Supplier invoice, measured opening count, or waste reason"
                />
              </label>
              <div className="flex items-end sm:col-span-2 lg:col-span-2">
                <button
                  type="submit"
                  className="w-full rounded-ctrl bg-forest-900 px-5 py-3 text-sm font-bold text-white hover:bg-forest-800"
                >
                  Record movement
                </button>
              </div>
            </form>
          </section>

          <section className="overflow-hidden rounded-card border border-ivory-300 bg-white shadow-warm">
            <div className="border-b border-ivory-200 bg-ivory-50 px-5 py-4">
              <h2 className="font-display text-xl font-semibold text-ink-900">Recent movement history</h2>
              <p className="mt-1 text-xs text-ink-500">Latest 60 ledger rows · entries cannot be edited or deleted.</p>
            </div>
            {recent.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="bg-forest-900 text-xs uppercase tracking-wider text-gold-100">
                    <tr>
                      <th className="px-4 py-3">When</th>
                      <th className="px-4 py-3">Ingredient</th>
                      <th className="px-4 py-3">Change</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3">Reference / actor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ivory-200">
                    {recent.map((movement) => (
                      <tr key={movement.id}>
                        <td className="px-4 py-3 text-xs text-ink-500">{timeLabel(movement.createdAt)}</td>
                        <th scope="row" className="px-4 py-3 font-semibold text-ink-900">
                          {movement.ingredientName}
                        </th>
                        <td
                          className={`px-4 py-3 font-mono font-semibold ${movement.deltaG < 0 ? 'text-danger' : 'text-forest-800'}`}
                        >
                          {movement.deltaG > 0 ? '+' : ''}
                          {gramsLabel(movement.deltaG)}
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-ink-700">
                          {movement.reason.replaceAll('_', ' ')}
                        </td>
                        <td className="px-4 py-3 text-xs text-ink-500">
                          {movement.orderId ? `Order ${movement.orderId}` : (movement.note ?? '—')}
                          <br />
                          {movement.actorName ?? movement.actorEmail ?? 'System'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-ink-500">
                No movements yet. Add a verified opening count or record a stock receipt.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
