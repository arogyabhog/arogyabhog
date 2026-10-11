'use server';

import { and, eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db as schemaDb } from '@/db/client';
import { auditLog, productRecipeLines, products, productVariants } from '@/db/schema';
import { canManageOrder } from '@/server/admin-order-access';
import { getCurrentUser } from '@/server/auth';
import { validRecipeRatios } from '@/server/product-admin-validation';
import { rupeesToPaise } from '@/server/rupees-to-paise';

const db = schemaDb as unknown as LibSQLDatabase;
const productIdField = z.string().min(1).max(100);
const rupeesField = z
  .string()
  .min(1)
  .max(10)
  .regex(/^\d{1,7}(?:\.\d{1,2})?$/);

async function requireCatalogStaff() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) redirect('/login');
  return user;
}

async function accessibleProduct(productId: string, storeId: string | null, role: string) {
  const product = await db.select().from(products).where(eq(products.id, productId)).get();
  return product && canManageOrder({ role, storeId }, product.storeId) ? product : null;
}

function refreshCatalog(product: { id: string; slug: string }) {
  revalidatePath('/admin/products');
  revalidatePath(`/admin/products/${product.id}`);
  revalidatePath(`/shop/${product.slug}`);
  revalidatePath('/shop');
  revalidatePath('/');
}

export async function updateProductDetails(formData: FormData): Promise<void> {
  const staff = await requireCatalogStaff();
  const parsed = z
    .object({
      productId: productIdField,
      name: z.string().trim().min(2).max(100),
      description: z.string().trim().max(2000),
      status: z.enum(['active', 'inactive']),
    })
    .safeParse({
      productId: formData.get('productId'),
      name: formData.get('name'),
      description: formData.get('description') ?? '',
      status: formData.get('status'),
    });
  if (!parsed.success) redirect('/admin/products?notice=invalid');
  const product = await accessibleProduct(parsed.data.productId, staff.storeId, staff.role);
  if (!product) redirect('/admin/products?notice=unavailable');

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(products)
        .set({
          name: parsed.data.name,
          description: parsed.data.description || null,
          status: parsed.data.status,
          updatedAt: Date.now(),
        })
        .where(eq(products.id, product.id));
      await tx.insert(auditLog).values({
        actorUserId: staff.id,
        action: 'PRODUCT_UPDATED',
        entityType: 'product',
        entityId: product.id,
        beforeJson: JSON.stringify({ name: product.name, description: product.description, status: product.status }),
        afterJson: JSON.stringify({
          name: parsed.data.name,
          description: parsed.data.description || null,
          status: parsed.data.status,
        }),
      });
    });
  } catch {
    redirect(`/admin/products/${product.id}?notice=save-failed`);
  }
  refreshCatalog(product);
  redirect(`/admin/products/${product.id}?notice=saved`);
}

export async function updateProductVariant(formData: FormData): Promise<void> {
  const staff = await requireCatalogStaff();
  const parsed = z
    .object({
      productId: productIdField,
      packSizeG: z.coerce.number().int().min(1000).max(20000),
      costRupees: rupeesField,
      sellRupees: rupeesField,
      active: z.enum(['active', 'inactive']),
    })
    .safeParse({
      productId: formData.get('productId'),
      packSizeG: formData.get('packSizeG'),
      costRupees: formData.get('costRupees'),
      sellRupees: formData.get('sellRupees'),
      active: formData.get('active'),
    });
  if (!parsed.success) redirect('/admin/products?notice=invalid');
  const product = await accessibleProduct(parsed.data.productId, staff.storeId, staff.role);
  if (!product) redirect('/admin/products?notice=unavailable');
  const costPaise = rupeesToPaise(parsed.data.costRupees);
  const sellPaise = rupeesToPaise(parsed.data.sellRupees);
  if (costPaise === null || sellPaise === null) redirect(`/admin/products/${product.id}?notice=invalid`);
  const variant = await db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.productId, product.id), eq(productVariants.packSizeG, parsed.data.packSizeG)))
    .get();
  if (!variant) redirect(`/admin/products/${product.id}?notice=unavailable`);

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(productVariants)
        .set({
          costPaise,
          sellPaise,
          active: parsed.data.active === 'active',
          provisional: false,
          sellSource: 'client',
        })
        .where(and(eq(productVariants.productId, product.id), eq(productVariants.packSizeG, variant.packSizeG)));
      await tx.insert(auditLog).values({
        actorUserId: staff.id,
        action: 'PRODUCT_VARIANT_UPDATED',
        entityType: 'product_variant',
        entityId: `${product.id}:${variant.packSizeG}`,
        beforeJson: JSON.stringify({
          costPaise: variant.costPaise,
          sellPaise: variant.sellPaise,
          active: variant.active,
          provisional: variant.provisional,
        }),
        afterJson: JSON.stringify({
          costPaise,
          sellPaise,
          active: parsed.data.active === 'active',
          provisional: false,
        }),
      });
    });
  } catch {
    redirect(`/admin/products/${product.id}?notice=save-failed`);
  }
  refreshCatalog(product);
  redirect(`/admin/products/${product.id}?notice=variant-saved`);
}

export async function updateProductRecipe(formData: FormData): Promise<void> {
  const staff = await requireCatalogStaff();
  const parsed = z
    .object({
      productId: productIdField,
      ingredientIds: z.array(z.string().min(1).max(64)).min(1).max(20),
      ratios: z.array(z.coerce.number().int().min(1).max(10000)).min(1).max(20),
    })
    .safeParse({
      productId: formData.get('productId'),
      ingredientIds: formData.getAll('ingredientId'),
      ratios: formData.getAll('ratioBps'),
    });
  if (!parsed.success || parsed.data.ingredientIds.length !== parsed.data.ratios.length) {
    redirect('/admin/products?notice=invalid-recipe');
  }
  const product = await accessibleProduct(parsed.data.productId, staff.storeId, staff.role);
  if (product?.kind !== 'premade') redirect('/admin/products?notice=unavailable');
  const current = await db.select().from(productRecipeLines).where(eq(productRecipeLines.productId, product.id)).all();
  const submitted = parsed.data.ingredientIds.map((ingredientId, index) => ({
    ingredientId,
    ratioBps: parsed.data.ratios[index] ?? 0,
  }));
  if (
    !validRecipeRatios(
      current.map((line) => line.ingredientId),
      submitted,
    )
  ) {
    redirect(`/admin/products/${product.id}?notice=invalid-recipe`);
  }

  try {
    await db.transaction(async (tx) => {
      await tx.delete(productRecipeLines).where(eq(productRecipeLines.productId, product.id));
      await tx.insert(productRecipeLines).values(
        submitted.map((line) => ({
          productId: product.id,
          ingredientId: line.ingredientId,
          ratioBps: line.ratioBps,
        })),
      );
      await tx.insert(auditLog).values({
        actorUserId: staff.id,
        action: 'PRODUCT_RECIPE_UPDATED',
        entityType: 'product_recipe',
        entityId: product.id,
        beforeJson: JSON.stringify(current.map(({ ingredientId, ratioBps }) => ({ ingredientId, ratioBps }))),
        afterJson: JSON.stringify(submitted),
      });
    });
  } catch {
    redirect(`/admin/products/${product.id}?notice=save-failed`);
  }
  refreshCatalog(product);
  redirect(`/admin/products/${product.id}?notice=recipe-saved`);
}
