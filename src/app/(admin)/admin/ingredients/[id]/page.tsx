import { and, desc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { ingredientPriceHistory, ingredients, users } from '@/db/schema';
import { canManageOrder } from '@/server/admin-order-access';
import { requireStaff } from '@/server/auth';

export const dynamic = 'force-dynamic';
const money = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);

export default async function IngredientRateHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const ingredient = await db.select().from(ingredients).where(eq(ingredients.id, id)).get();
  if (!ingredient || !canManageOrder({ role: staff.role, storeId: staff.storeId }, ingredient.storeId)) notFound();

  const history = await db
    .select({
      row: ingredientPriceHistory,
      actorName: users.displayName,
      actorEmail: users.email,
    })
    .from(ingredientPriceHistory)
    .leftJoin(users, eq(users.id, ingredientPriceHistory.actorUserId))
    .where(
      and(
        eq(ingredientPriceHistory.storeId, ingredient.storeId),
        eq(ingredientPriceHistory.ingredientId, ingredient.id),
      ),
    )
    .orderBy(desc(ingredientPriceHistory.changedAt))
    .limit(100)
    .all();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-forest-700">Ingredient · {ingredient.id}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink-900">{ingredient.name} rate history</h1>
        <p className="mt-2 text-sm text-ink-500">
          Current: cost {money(ingredient.costPaisePerKg)} / kg · sell {money(ingredient.sellPaisePerKg)} / kg
        </p>
      </div>

      <div className="overflow-x-auto rounded-card border border-ivory-300 bg-white shadow-warm">
        <table className="w-full min-w-[740px] text-sm">
          <thead className="bg-forest-900 text-left text-xs uppercase tracking-wide text-gold-200">
            <tr>
              <th className="px-4 py-3 font-bold">Changed</th>
              <th className="px-4 py-3 font-bold">Cost / kg</th>
              <th className="px-4 py-3 font-bold">Sell / kg</th>
              <th className="px-4 py-3 font-bold">Provenance</th>
              <th className="px-4 py-3 font-bold">Recorded by</th>
            </tr>
          </thead>
          <tbody>
            {history.map(({ row, actorName, actorEmail }) => (
              <tr key={row.id} className="border-b border-ivory-200 last:border-b-0">
                <td className="whitespace-nowrap px-4 py-3 text-ink-600">
                  {new Date(row.changedAt).toLocaleString('en-IN')}
                </td>
                <td className="tnum px-4 py-3 text-ink-800">{money(row.costPaisePerKg)}</td>
                <td className="tnum px-4 py-3 font-semibold text-ink-900">{money(row.sellPaisePerKg)}</td>
                <td className="px-4 py-3 text-ink-600">
                  {row.ratesProvisional ? 'Provisional' : 'Client-confirmed'} · {row.sellSource}
                </td>
                <td className="px-4 py-3 text-ink-600">{actorName ?? actorEmail ?? 'Seed baseline'}</td>
              </tr>
            ))}
            {!history.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-500">
                  No rate history recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
