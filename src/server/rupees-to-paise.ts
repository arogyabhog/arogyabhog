/** Parse user-entered rupees as decimal text without floating-point arithmetic. */
export function rupeesToPaise(value: string): number | null {
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(value)) return null;
  const parts = value.split('.');
  const rupees = parts[0];
  const fraction = parts[1] ?? '';
  if (rupees === undefined) return null;
  const paise = BigInt(rupees) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (paise < 1n || paise > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(paise);
}
