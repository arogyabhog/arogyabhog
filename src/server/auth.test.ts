/** Auth core (ADR-031) + audit CSV export (ADR-015) — pure unit tests. */
import { describe, expect, it } from 'vitest';
import { type AuditRow, auditCsv } from './audit-export';
import { hashPassword, verifyPassword } from './passwords';

describe('password hashing (scrypt)', () => {
  it('round-trips a password', () => {
    const hash = hashPassword('arogyabhog-dev-admin');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(verifyPassword('arogyabhog-dev-admin', hash)).toBe(true);
  });
  it('rejects a wrong password', () => {
    const hash = hashPassword('correct-horse');
    expect(verifyPassword('correct-hors', hash)).toBe(false);
  });
  it('salts each hash differently', () => {
    expect(hashPassword('same')).not.toEqual(hashPassword('same'));
  });
  it('rejects malformed stored hashes', () => {
    expect(verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(verifyPassword('x', 'scrypt$')).toBe(false);
    expect(verifyPassword('x', 'bcrypt$ab$cd')).toBe(false);
  });
});

describe('audit CSV export', () => {
  const rows: AuditRow[] = [
    {
      id: 1,
      at: Date.UTC(2026, 9, 13, 10, 0, 0),
      actorUserId: 'us_admin_seed',
      action: 'auth.login',
      entityType: 'user',
      entityId: 'us_admin_seed',
      beforeJson: null,
      afterJson: null,
    },
    {
      id: 2,
      at: Date.UTC(2026, 9, 13, 10, 5, 0),
      actorUserId: null,
      action: 'price.update',
      entityType: 'product_variant',
      entityId: 'pv_everyday_10',
      beforeJson: '{"sellPaise":95000}',
      afterJson: '{"sellPaise":96000,"note":"say, \\"hi\\""}',
    },
  ];
  it('emits a header plus one line per row', () => {
    const csv = auditCsv(rows);
    expect(csv.split('\n')).toHaveLength(3);
    expect(csv.startsWith('id,at_iso,actor_user_id,action,entity_type,entity_id,before_json,after_json')).toBe(true);
  });
  it('quotes fields containing commas or quotes and escapes inner quotes', () => {
    const csv = auditCsv(rows);
    const line = csv.split('\n')[2];
    expect(line).toContain('"{""sellPaise"":95000}"'); // before_json quoted
    expect(line).toMatch(/,"{""sellPaise"":96000,""note"":.*}"$/); // after_json quoted to EOL
  });
  it('renders null actor as empty', () => {
    const csv = auditCsv(rows);
    expect(csv.split('\n')[2]).toMatch(/^2,[^,]+,,price\.update,/);
  });
});
