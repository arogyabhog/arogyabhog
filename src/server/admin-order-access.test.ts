import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { canManageOrder } from './admin-order-access';

describe('admin order store boundary', () => {
  it('lets a global admin manage orders in any store', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), (assignedStore, orderStore) => {
        expect(canManageOrder({ role: 'ADMIN', storeId: assignedStore }, orderStore)).toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  it('lets a manager access only the exact assigned store', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.option(fc.string(), { nil: null }),
        (orderStore, otherStore, managerStore) => {
          expect(canManageOrder({ role: 'MANAGER', storeId: orderStore }, orderStore)).toBe(true);
          const result = canManageOrder({ role: 'MANAGER', storeId: managerStore }, otherStore);
          expect(result).toBe(managerStore !== null && managerStore === otherStore);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('denies customers and unknown roles even when store ids match', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), (storeId, role) => {
        fc.pre(role !== 'ADMIN' && role !== 'MANAGER');
        expect(canManageOrder({ role, storeId }, storeId)).toBe(false);
      }),
      { numRuns: 500 },
    );
  });
});
