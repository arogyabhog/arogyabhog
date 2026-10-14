'use server';

import { and, eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db as schemaDb } from '@/db/client';
import { auditLog, stores } from '@/db/schema';
import { canManageOrder } from '@/server/admin-order-access';
import { getCurrentUser } from '@/server/auth';
import { parseStoreSettings } from '@/server/store-settings-validation';

const db = schemaDb as unknown as LibSQLDatabase;

export async function updateStoreSettings(formData: FormData): Promise<void> {
  const staff = await getCurrentUser();
  if (!staff || (staff.role !== 'ADMIN' && staff.role !== 'MANAGER')) redirect('/login');

  const parsed = parseStoreSettings({
    storeId: formData.get('storeId'),
    name: formData.get('name'),
    city: formData.get('city'),
    upiVpa: formData.get('upiVpa'),
    deliveryFeeRupees: formData.get('deliveryFeeRupees'),
    packagingFeeRupees: formData.get('packagingFeeRupees'),
    millingFeeRupeesPerKg: formData.get('millingFeeRupeesPerKg'),
    gstRateBps: formData.get('gstRateBps'),
    priceConsistencyToleranceBps: formData.get('priceConsistencyToleranceBps'),
    minBaseGrainBps: formData.get('minBaseGrainBps'),
    referralCreditCap: formData.get('referralCreditCap'),
    refereeBonusCredits: formData.get('refereeBonusCredits'),
    allowedPackSizesG: formData.get('allowedPackSizesG'),
  });
  if (!parsed.success) redirect('/admin/settings?notice=invalid');

  const store = await db.select().from(stores).where(eq(stores.id, parsed.data.storeId)).get();
  if (!store || !canManageOrder({ role: staff.role, storeId: staff.storeId }, store.id)) {
    redirect('/admin/settings?notice=unavailable');
  }

  const before = {
    name: store.name,
    city: store.city,
    upiVpa: store.upiVpa,
    deliveryFeePaise: store.deliveryFeePaise,
    packagingFeePaise: store.packagingFeePaise,
    millingFeePaisePerKg: store.millingFeePaisePerKg,
    gstRateBps: store.gstRateBps,
    priceConsistencyToleranceBps: store.priceConsistencyToleranceBps,
    minBaseGrainBps: store.minBaseGrainBps,
    referralCreditCap: store.referralCreditCap,
    refereeBonusCredits: store.refereeBonusCredits,
    allowedPackSizesG: JSON.parse(store.allowedPackSizesG) as number[],
  };
  const after = {
    name: parsed.data.name,
    city: parsed.data.city,
    upiVpa: parsed.data.upiVpa,
    deliveryFeePaise: parsed.data.deliveryFeeRupees,
    packagingFeePaise: parsed.data.packagingFeeRupees,
    millingFeePaisePerKg: parsed.data.millingFeeRupeesPerKg,
    gstRateBps: parsed.data.gstRateBps,
    priceConsistencyToleranceBps: parsed.data.priceConsistencyToleranceBps,
    minBaseGrainBps: parsed.data.minBaseGrainBps,
    referralCreditCap: parsed.data.referralCreditCap,
    refereeBonusCredits: parsed.data.refereeBonusCredits,
    allowedPackSizesG: parsed.data.allowedPackSizesG,
  };

  try {
    await db.transaction(async (tx) => {
      const updateResult = await tx
        .update(stores)
        .set({
          name: after.name,
          city: after.city,
          upiVpa: after.upiVpa,
          deliveryFeePaise: after.deliveryFeePaise,
          packagingFeePaise: after.packagingFeePaise,
          millingFeePaisePerKg: after.millingFeePaisePerKg,
          gstRateBps: after.gstRateBps,
          priceConsistencyToleranceBps: after.priceConsistencyToleranceBps,
          minBaseGrainBps: after.minBaseGrainBps,
          referralCreditCap: after.referralCreditCap,
          refereeBonusCredits: after.refereeBonusCredits,
          allowedPackSizesG: JSON.stringify(after.allowedPackSizesG),
          updatedAt: Date.now(),
        })
        .where(and(eq(stores.id, store.id), eq(stores.updatedAt, store.updatedAt)))
        .run();
      if (updateResult.rowsAffected !== 1) throw new Error('CONCURRENT_STORE_EDIT');
      await tx.insert(auditLog).values({
        actorUserId: staff.id,
        action: 'STORE_SETTINGS_UPDATED',
        entityType: 'store',
        entityId: store.id,
        beforeJson: JSON.stringify(before),
        afterJson: JSON.stringify(after),
      });
    });
  } catch {
    redirect(`/admin/settings?storeId=${encodeURIComponent(store.id)}&notice=save-failed`);
  }

  revalidatePath('/admin/settings');
  revalidatePath('/admin');
  revalidatePath('/admin/price-consistency');
  revalidatePath('/lab');
  revalidatePath('/checkout');
  redirect(`/admin/settings?storeId=${encodeURIComponent(store.id)}&notice=saved`);
}
