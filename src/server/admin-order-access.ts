export interface OrderStaffScope {
  role: string;
  storeId: string | null;
}

/** Admins are global; managers may access only orders in their assigned store. */
export function canManageOrder(scope: OrderStaffScope, orderStoreId: string): boolean {
  return (
    scope.role === 'ADMIN' || (scope.role === 'MANAGER' && scope.storeId !== null && scope.storeId === orderStoreId)
  );
}
