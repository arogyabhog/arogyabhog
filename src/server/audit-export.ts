/** Pure CSV serialisation for the ADR-015 exportable audit list. */
export interface AuditRow {
  id: number;
  at: number;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson: string | null;
  afterJson: string | null;
}

const esc = (v: string | null): string => {
  if (v === null) return '';
  return /[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
};

export function auditCsv(rows: AuditRow[]): string {
  const head = 'id,at_iso,actor_user_id,action,entity_type,entity_id,before_json,after_json';
  const lines = rows.map((r) =>
    [
      String(r.id),
      new Date(r.at).toISOString(),
      esc(r.actorUserId),
      esc(r.action),
      esc(r.entityType),
      esc(r.entityId),
      esc(r.beforeJson),
      esc(r.afterJson),
    ].join(','),
  );
  return [head, ...lines].join('\n');
}
