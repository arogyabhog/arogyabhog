/** Pure scrypt hashing (ADR-031) — no Next/db imports so seeders and tests
 *  can use it safely. */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 16384;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64, { N: SCRYPT_N }).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64, { N: SCRYPT_N });
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
