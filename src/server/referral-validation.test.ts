import { describe, expect, it } from 'vitest';
import { hashSignupDeviceToken, validateReferralCreditSelection } from './referral-validation';

describe('signup abuse signal token', () => {
  it('hashes a valid random token and never returns the token itself', () => {
    const token = 'a0123456789abcdef0123456789abcde';
    const hash = hashSignupDeviceToken(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashSignupDeviceToken(token.toUpperCase())).toBe(hash);
  });

  it('ignores missing or malformed values', () => {
    expect(hashSignupDeviceToken(null)).toBeNull();
    expect(hashSignupDeviceToken('')).toBeNull();
    expect(hashSignupDeviceToken('user-agent-string')).toBeNull();
    expect(hashSignupDeviceToken('a'.repeat(31))).toBeNull();
  });

  it('validates one delivery credit per selected sibling order and blocks delivery-coupon stacking', () => {
    const base = { requested: 1, available: 2, lineCount: 3, couponType: 'PERCENT' };
    expect(validateReferralCreditSelection(base)).toBeNull();
    expect(validateReferralCreditSelection({ ...base, requested: 3 })).toBe('NO_CREDITS');
    expect(validateReferralCreditSelection({ ...base, requested: -1 })).toBe('INVALID');
    expect(validateReferralCreditSelection({ ...base, couponType: 'FREE_DELIVERY' })).toBe('FREE_DELIVERY_COUPON');
  });
});
