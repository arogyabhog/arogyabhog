/**
 * POST /api/storefront/mix/calculate
 * Thin transport layer: validate → service → typed error envelope.
 * All domain logic lives in the engine + service (testable without Next).
 */
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { MixError } from '@/domain/mix-engine';
import { type ErrorEnvelope, mixCalculateRequestSchema, NUTRITION_NOTICE } from '@/server/contracts';
import { calculateMixFromDb } from '@/server/mix-service';

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } } satisfies ErrorEnvelope,
      { status: 400 },
    );
  }

  const parsed = mixCalculateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: parsed.error.issues[0]?.message ?? 'Invalid request',
          details: { issues: parsed.error.issues },
        },
      } satisfies ErrorEnvelope,
      { status: 400 },
    );
  }

  try {
    const calc = await calculateMixFromDb(db, parsed.data);
    return NextResponse.json({
      ...calc,
      notice: NUTRITION_NOTICE,
    });
  } catch (e) {
    if (e instanceof MixError) {
      // Missing price/nutrient data is a data-state conflict, not a bad request.
      const status = e.code === 'INCOMPLETE_INGREDIENT_DATA' ? 409 : 422;
      return NextResponse.json(
        { error: { code: e.code, message: e.message, details: e.details } } satisfies ErrorEnvelope,
        { status },
      );
    }
    throw e; // EngineBugError and friends must surface loudly (R6)
  }
}
