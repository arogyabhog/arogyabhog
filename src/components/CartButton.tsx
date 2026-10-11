'use client';

import { useEffect, useState } from 'react';
import { CART_EVENT, cartCount } from '@/lib/cart';

export function CartButton() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const sync = () => setCount(cartCount());
    sync();
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return (
    <a
      href="/checkout"
      className="flex shrink-0 items-center gap-2 rounded-ctrl border border-forest-600 px-2.5 py-1.5 text-xs font-bold text-forest-700 sm:px-3 sm:text-sm"
    >
      Cart
      <span className="tnum rounded-full bg-forest-600 px-1.5 text-[10px] font-bold text-forest-50">{count}</span>
    </a>
  );
}
