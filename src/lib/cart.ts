/** Client-side cart (localStorage). Orders are server-authoritative; the cart
 *  is only a shopping basket between browsing and checkout. */
export const CART_KEY = 'ab_cart_v1';
export const CART_EVENT = 'ab-cart-change';

export interface CartLine {
  slug: string;
  packG: number;
  qty: number;
}

export function getCart(): CartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    const parsed = raw ? (JSON.parse(raw) as CartLine[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCart(lines: CartLine[]): void {
  window.localStorage.setItem(CART_KEY, JSON.stringify(lines));
  window.dispatchEvent(new Event(CART_EVENT));
}

export function addToCart(line: CartLine): void {
  const cart = getCart();
  const existing = cart.find((l) => l.slug === line.slug && l.packG === line.packG);
  if (existing) existing.qty += line.qty;
  else cart.push(line);
  writeCart(cart);
}

export function cartCount(): number {
  return getCart().reduce((a, l) => a + l.qty, 0);
}
