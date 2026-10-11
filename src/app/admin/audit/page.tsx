import { desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { auditLog } from '@/db/schema';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  const rows = await db.select().from(auditLog).orderBy(desc(auditLog.at)).limit(200);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-2xl font-semibold text-ink-900">Audit log</h2>
        <a
          href="/admin/audit/export.csv"
          className="rounded-ctrl border border-forest-600 px-4 py-2 text-sm font-bold text-forest-700 hover:bg-forest-50"
        >
          Export full list (CSV)
        </a>
      </div>
      <div className="overflow-x-auto rounded-card border border-ivory-300 bg-white shadow-warm">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-ivory-300 bg-forest-900 text-left text-[11px] uppercase tracking-wide text-gold-200">
              <th className="px-4 py-3 font-bold">#</th>
              <th className="px-4 py-3 font-bold">When</th>
              <th className="px-4 py-3 font-bold">Actor</th>
              <th className="px-4 py-3 font-bold">Action</th>
              <th className="px-4 py-3 font-bold">Entity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-ivory-200">
                <td className="tnum px-4 py-2.5 text-ink-500">{r.id}</td>
                <td className="tnum px-4 py-2.5 text-ink-500">
                  {new Date(r.at).toISOString().slice(0, 19).replace('T', ' ')}
                </td>
                <td className="px-4 py-2.5 text-ink-700">{r.actorUserId ?? '—'}</td>
                <td className="px-4 py-2.5 font-semibold text-ink-900">{r.action}</td>
                <td className="px-4 py-2.5 text-ink-500">
                  {r.entityType} · {r.entityId}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-500">
                  No audit entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
