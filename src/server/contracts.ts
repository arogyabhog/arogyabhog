/**
 * API contracts for the storefront mix endpoints (`06_API_CONTRACTS.md`).
 * Zod at the boundary (R2): nothing downstream trusts the client payload.
 */
import { z } from 'zod';

export const mixItemSchema = z.object({
  ingredientId: z.string().min(2).max(40),
  weightG: z.number().int().positive().max(200_000),
});

export const mixCalculateRequestSchema = z.object({
  storeId: z.string().min(1).max(64),
  targetWeightG: z.number().int().positive().max(200_000),
  packageCount: z.number().int().positive().max(100).default(1),
  items: z.array(mixItemSchema).min(2, 'A mix needs at least two ingredients').max(12),
});

export type MixCalculateRequest = z.infer<typeof mixCalculateRequestSchema>;

/** Nutrients the Lab certificate displays, in display order. */
export const DISPLAY_NUTRIENTS = [
  'enerc',
  'protcnt',
  'fatce',
  'fibtg',
  'choavldf',
  'ca',
  'fe',
  'zn',
  'mg',
  'p',
  'k',
  'na',
] as const;

export const NUTRITION_NOTICE =
  'Estimated from published composition tables (IFCT 2017, USDA where IFCT is silent). Not lab-analysed.';

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
