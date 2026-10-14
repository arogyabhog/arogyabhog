import { z } from 'zod';

export const manualInventoryMovementSchema = z
  .object({
    storeId: z.string().min(1).max(64),
    ingredientId: z.string().min(1).max(64),
    reason: z.enum(['PURCHASE', 'WASTAGE', 'ADJUSTMENT']),
    deltaG: z
      .string()
      .regex(/^-?\d{1,8}$/)
      .transform(Number),
    note: z.string().trim().min(2).max(300),
  })
  .refine(({ deltaG }) => deltaG !== 0, { path: ['deltaG'], message: 'Movement must be nonzero.' })
  .refine(({ reason, deltaG }) => (reason !== 'PURCHASE' || deltaG > 0) && (reason !== 'WASTAGE' || deltaG < 0), {
    path: ['deltaG'],
    message: 'Purchases must be positive; wastage must be negative.',
  });

export function parseManualInventoryMovement(input: Record<string, unknown>) {
  return manualInventoryMovementSchema.safeParse(input);
}
