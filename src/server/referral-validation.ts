import { createHash } from 'node:crypto';

/** Accept only the random 128-bit first-party token; persist a one-way SHA-256 digest. */
export type ReferralCreditSelectionError = 'INVALID' | 'NO_CREDITS' | 'FREE_DELIVERY_COUPON';

export function validateReferralCreditSelection(input: {
  requested: number;
  available: number;
  lineCount: number;
  couponType: string | null;
}): ReferralCreditSelectionError | null {
  if (!Number.isInteger(input.requested) || input.requested < 0) return 'INVALID';
  if (input.requested > input.available || input.requested > input.lineCount) return 'NO_CREDITS';
  if (input.requested > 0 && input.couponType === 'FREE_DELIVERY') return 'FREE_DELIVERY_COUPON';
  return null;
}

export function hashSignupDeviceToken(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const token = raw.trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  return createHash('sha256').update(token).digest('hex');
}
