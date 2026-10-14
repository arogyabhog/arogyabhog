import { z } from 'zod';

const rupeesText = z.string().regex(/^\d{1,7}(?:\.\d{1,2})?$/);
const bpsText = z
  .string()
  .regex(/^\d{1,5}$/)
  .transform(Number)
  .pipe(z.number().int().min(0).max(10000));
const integerText = z
  .string()
  .regex(/^\d{1,5}$/)
  .transform(Number);
const upiText = z
  .string()
  .trim()
  .min(3)
  .max(256)
  .regex(/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/);

function rupeesToPaiseIncludingZero(value: string): number {
  const [rupees = '0', fraction = ''] = value.split('.');
  return Number(BigInt(rupees) * 100n + BigInt(fraction.padEnd(2, '0')));
}

export const storeSettingsSchema = z.object({
  storeId: z.string().min(1).max(64),
  name: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  upiVpa: upiText,
  deliveryFeeRupees: rupeesText.transform(rupeesToPaiseIncludingZero),
  packagingFeeRupees: rupeesText.transform(rupeesToPaiseIncludingZero),
  millingFeeRupeesPerKg: rupeesText.transform(rupeesToPaiseIncludingZero),
  gstRateBps: bpsText,
  priceConsistencyToleranceBps: bpsText,
  minBaseGrainBps: bpsText,
  referralCreditCap: integerText.pipe(z.number().int().min(0).max(10000)),
  refereeBonusCredits: integerText.pipe(z.number().int().min(0).max(100)),
  allowedPackSizesG: z
    .string()
    .min(1)
    .max(64)
    .transform((value, ctx) => {
      const allowed = new Set([5000, 10000, 15000, 20000]);
      const values = value.split(',').map((part) => Number(part.trim()));
      if (
        values.length === 0 ||
        values.some((size) => !Number.isInteger(size) || !allowed.has(size)) ||
        new Set(values).size !== values.length
      ) {
        ctx.addIssue({ code: 'custom', message: 'Use unique mix pack sizes from 5000, 10000, 15000, 20000 grams.' });
        return z.NEVER;
      }
      return [...values].sort((a, b) => a - b);
    }),
});

export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>;

export function parseStoreSettings(input: Record<string, unknown>) {
  return storeSettingsSchema.safeParse(input);
}
