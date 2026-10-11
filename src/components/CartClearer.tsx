'use client';

/** Clears the basket once an order placement redirect lands (placed=1). */
import { useEffect } from 'react';
import { writeCart } from '@/lib/cart';

export function CartClearer() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('placed') === '1') {
      writeCart([]);
      params.delete('placed');
      window.history.replaceState(null, '', `${window.location.pathname}${params.toString() ? `?${params}` : ''}`);
    }
  }, []);
  return null;
}
