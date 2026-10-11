import { desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { auditLog } from '@/db/schema';
import { auditCsv } from '@/server/audit-export';
import { getCurrentUser, writeAudit } from '@/server/auth';

export const dynamic = 'force-dynamic';

/** ADR-015: the audit trail must be exportable as a list. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    return new Response('Staff session required', { status: 401 });
  }
  const rows = await db.select().from(auditLog).orderBy(desc(auditLog.at));
  await writeAudit({
    actorUserId: user.id,
    action: 'audit.export',
    entityType: 'audit_log',
    entityId: `rows:${rows.length}`,
  });
  return new Response(auditCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="arogyabhog-audit-log.csv"',
    },
  });
}
