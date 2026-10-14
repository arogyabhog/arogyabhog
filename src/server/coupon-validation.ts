import { z } from 'zod';

const optionalInteger = z
  .union([z.literal(''), z.string().regex(/^\d{1,5}$/)])
  .transform((value) => (value === '' ? null : Number(value)));
const optionalRupees = z.union([z.literal(''), z.string().regex(/^\d{1,7}(?:\.\d{1,2})?$/)]);
const moneyToPaise = (value: string) => {
  const [rupees = '0', fraction = ''] = value.split('.');
  return Number(BigInt(rupees) * 100n + BigInt(fraction.padEnd(2, '0')));
};

const couponSchema = z.object({
  storeId: z.string().min(1).max(64),
  code: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9_-]{2,31}$/)),
  type: z.enum(['PERCENT', 'FLAT', 'FREE_DELIVERY']),
  valueBps: z
    .string()
    .regex(/^\d{1,5}$/)
    .transform(Number)
    .pipe(z.number().int().min(0).max(10000)),
  valueRupees: z.string().regex(/^\d{1,7}(?:\.\d{1,2})?$/),
  minOrderRupees: optionalRupees,
  maxDiscountRupees: optionalRupees,
  usageLimit: optionalInteger,
  perUserLimit: optionalInteger,
  expiresOn: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
});

export interface CouponFormSettings {
  storeId: string;
  code: string;
  type: 'PERCENT' | 'FLAT' | 'FREE_DELIVERY';
  value: number;
  minOrderPaise: number | null;
  maxDiscountPaise: number | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  startsAt: number | null;
  expiresAt: number | null;
}

export function parseCouponSettings(input: Record<string, unknown>, role: string) {
  const parsed = couponSchema.safeParse(input);
  if (!parsed.success) return parsed;
  const value = parsed.data;
  const percent = value.type === 'PERCENT';
  const flat = value.type === 'FLAT';
  const valuePaise = flat ? moneyToPaise(value.valueRupees) : 0;
  const minimumPaise = value.minOrderRupees === '' ? null : moneyToPaise(value.minOrderRupees);
  const maxDiscountPaise = value.maxDiscountRupees === '' ? null : moneyToPaise(value.maxDiscountRupees);
  const expiresAt = value.expiresOn === '' ? null : Date.parse(`${value.expiresOn}T23:59:59.999Z`);
  const typeValue = percent ? value.valueBps : valuePaise;

  const customIssues: string[] = [];
  if (percent && (value.valueBps < 1 || maxDiscountPaise === null || maxDiscountPaise < 1)) {
    customIssues.push('Percentage coupons require 1–10000 bps and a positive maximum discount.');
  }
  if (flat && valuePaise < 1) customIssues.push('Flat coupons require a positive rupee amount.');
  if (value.type === 'FREE_DELIVERY' && value.valueBps !== 0)
    customIssues.push('Free-delivery coupons use zero value.');
  if (role === 'MANAGER' && percent && value.valueBps > 5000)
    customIssues.push('Manager-created percent coupons are capped at 50%.');
  if (role === 'MANAGER' && flat && valuePaise > 5000)
    customIssues.push('Manager-created flat coupons are capped at ₹50 per order.');
  if (role === 'MANAGER' && (maxDiscountPaise ?? 0) > 5000)
    customIssues.push('Manager-created coupon discount caps are limited to ₹50 per order.');
  if (value.expiresOn && (!Number.isFinite(expiresAt) || Number.isNaN(expiresAt)))
    customIssues.push('Expiry date is invalid.');
  if (minimumPaise !== null && minimumPaise < 0) customIssues.push('Minimum order cannot be negative.');

  if (customIssues.length) {
    return {
      success: false as const,
      error: { issues: customIssues.map((message) => ({ code: 'custom', path: [], message })) },
    };
  }

  return {
    success: true as const,
    data: {
      storeId: value.storeId,
      code: value.code,
      type: value.type,
      value: typeValue,
      minOrderPaise: minimumPaise,
      maxDiscountPaise,
      usageLimit: value.usageLimit,
      perUserLimit: value.perUserLimit,
      startsAt: null,
      expiresAt,
    } satisfies CouponFormSettings,
  };
}
