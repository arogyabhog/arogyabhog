'use server';

import { and, eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db as schemaDb } from '@/db/client';
import { auditLog, ingredients, inventoryMovements } from '@/db/schema';
import { canManageOrder } from '@/server/admin-order-access';
import { getCurrentUser } from '@/server/auth';
import { parseManualInventoryMovement } from '@/server/inventory-validation';

const db = schemaDb as unknown as LibSQLDatabase;

export async function recordInventoryMovement(formData: FormData): Promise<void> {
  const staff = await getCurrentUser();
  if (!staff || (staff.role !== 'ADMIN' && staff.role !== 'MANAGER')) redirect('/login');

  const parsed = parseManualInventoryMovement({
    storeId: formData.get('storeId'),
    ingredientId: formData.get('ingredientId'),
    reason: formData.get('reason'),
    deltaG: formData.get('deltaG'),
    note: formData.get('note'),
  });
  if (!parsed.success) redirect('/admin/inventory?notice=invalid');

  const ingredient = await db
    .select({ id: ingredients.id, storeId: ingredients.storeId, name: ingredients.name })
    .from(ingredients)
    .where(and(eq(ingredients.id, parsed.data.ingredientId), eq(ingredients.storeId, parsed.data.storeId)))
    .get();
  if (!ingredient || !canManageOrder({ role: staff.role, storeId: staff.storeId }, ingredient.storeId)) {
    redirect('/admin/inventory?notice=unavailable');
  }

  const movement = {
    storeId: ingredient.storeId,
    ingredientId: ingredient.id,
    deltaG: parsed.data.deltaG,
    reason: parsed.data.reason,
    orderId: null,
    note: parsed.data.note,
    actorUserId: staff.id,
  };
  try {
    await db.transaction(async (tx) => {
      await tx.insert(inventoryMovements).values(movement);
      await tx.insert(auditLog).values({
        actorUserId: staff.id,
        action: 'INVENTORY_MOVEMENT_RECORDED',
        entityType: 'inventory_movement',
        entityId: `${ingredient.storeId}:${ingredient.id}`,
        beforeJson: null,
        afterJson: JSON.stringify({ ...movement, ingredientName: ingredient.name }),
      });
    });
  } catch {
    redirect('/admin/inventory?notice=save-failed');
  }

  revalidatePath('/admin/inventory');
  revalidatePath('/admin');
  redirect(`/admin/inventory?storeId=${encodeURIComponent(ingredient.storeId)}&notice=saved`);
}
