'use server';

import { and, eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db as schemaDb } from '@/db/client';
import { auditLog, ingredientPriceHistory, ingredients } from '@/db/schema';
import { canManageOrder } from '@/server/admin-order-access';
import { getCurrentUser } from '@/server/auth';
import { rupeesToPaise } from '@/server/rupees-to-paise';

const db = schemaDb as unknown as LibSQLDatabase;
const rupeesField = z
  .string()
  .min(1)
  .max(10)
  .regex(/^\d{1,7}(?:\.\d{1,2})?$/);

export async function updateIngredientRate(formData: FormData): Promise<void> {
  const staff = await getCurrentUser();
  if (!staff || (staff.role !== 'ADMIN' && staff.role !== 'MANAGER')) redirect('/login');
  const parsed = z
    .object({
      ingredientId: z.string().min(1).max(64),
      costRupees: rupeesField,
      sellRupees: rupeesField,
    })
    .safeParse({
      ingredientId: formData.get('ingredientId'),
      costRupees: formData.get('costRupees'),
      sellRupees: formData.get('sellRupees'),
    });
  if (!parsed.success) redirect('/admin/ingredients?notice=invalid');

  const ingredient = await db.select().from(ingredients).where(eq(ingredients.id, parsed.data.ingredientId)).get();
  if (!ingredient || !canManageOrder({ role: staff.role, storeId: staff.storeId }, ingredient.storeId)) {
    redirect('/admin/ingredients?notice=unavailable');
  }
  const costPaisePerKg = rupeesToPaise(parsed.data.costRupees);
  const sellPaisePerKg = rupeesToPaise(parsed.data.sellRupees);
  if (costPaisePerKg === null || sellPaisePerKg === null) redirect('/admin/ingredients?notice=invalid');

  const before = {
    costPaisePerKg: ingredient.costPaisePerKg,
    sellPaisePerKg: ingredient.sellPaisePerKg,
    costSource: ingredient.costSource,
    sellSource: ingredient.sellSource,
    ratesProvisional: ingredient.ratesProvisional,
    reviewNote: ingredient.reviewNote,
  };
  const after = {
    costPaisePerKg,
    sellPaisePerKg,
    costSource: 'client',
    sellSource: 'client',
    ratesProvisional: false,
    reviewNote: null,
  };

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(ingredients)
        .set({ ...after, updatedAt: Date.now() })
        .where(and(eq(ingredients.id, ingredient.id), eq(ingredients.storeId, ingredient.storeId)));
      await tx.insert(ingredientPriceHistory).values({
        storeId: ingredient.storeId,
        ingredientId: ingredient.id,
        costPaisePerKg,
        sellPaisePerKg,
        costSource: 'client',
        sellSource: 'client',
        ratesProvisional: false,
        actorUserId: staff.id,
      });
      await tx.insert(auditLog).values({
        actorUserId: staff.id,
        action: 'INGREDIENT_RATES_UPDATED',
        entityType: 'ingredient',
        entityId: ingredient.id,
        beforeJson: JSON.stringify(before),
        afterJson: JSON.stringify(after),
      });
    });
  } catch {
    redirect('/admin/ingredients?notice=save-failed');
  }

  revalidatePath('/admin/ingredients');
  revalidatePath(`/admin/ingredients/${ingredient.id}`);
  revalidatePath('/admin/price-consistency');
  revalidatePath('/admin');
  revalidatePath('/lab');
  revalidatePath('/shop');
  revalidatePath('/');
  redirect('/admin/ingredients?notice=saved');
}
