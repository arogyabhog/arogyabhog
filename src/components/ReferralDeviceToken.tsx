'use client';

import { useEffect, useState } from 'react';

const KEY = 'ab_referral_device_v1';
const isToken = (value: string | null): value is string => value !== null && /^[a-f0-9]{32}$/i.test(value);

/** Random first-party token only; not a browser fingerprint. Server stores a hash, never this value. */
export function ReferralDeviceToken() {
  const [token, setToken] = useState('');
  useEffect(() => {
    let value = localStorage.getItem(KEY);
    if (!isToken(value)) {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(KEY, value);
    }
    setToken(value.toLowerCase());
  }, []);
  return <input type="hidden" name="deviceToken" value={token} readOnly />;
}
