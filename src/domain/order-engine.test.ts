import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  assertFulfillmentTransition,
  assertPaymentMethod,
  assertPaymentTransition,
  assertSnapshotConsistent,
  canCancel,
  decideDelivery,
  FULFILLMENT_STATUSES,
  FULFILLMENT_TRANSITIONS,
  gstSplitInclusive,
  OrderError,
  type OrderSnapshot,
  PAYMENT_STATUSES,
  PAYMENT_TRANSITIONS,
} from './order-engine';

const codeOf = (fn: () => void): string | null => {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof OrderError ? e.code : 'NON_ORDER_ERROR';
  }
};

describe('fulfilment machine', () => {
  it('allows exactly the ADR-027 transition table, pair by pair (full 9×9 matrix)', () => {
    for (const from of FULFILLMENT_STATUSES) {
      for (const to of FULFILLMENT_STATUSES) {
        const terminal = from === 'CLOSED' || from === 'CANCELLED';
        const legal = !terminal && FULFILLMENT_TRANSITIONS[from].includes(to);
        const code = codeOf(() => assertFulfillmentTransition(from, to, { paymentStatus: 'PAID' }));
        if (legal) expect(code, `${from}→${to} should pass`).toBeNull();
        else if (terminal) expect(code, `${from}→${to} should be immutable`).toBe('ORDER_IMMUTABLE');
        else expect(code, `${from}→${to} should be illegal`).toBe('ILLEGAL_FULFILLMENT_TRANSITION');
      }
    }
  });

  it('CLOSED is self-immutable: even CLOSED→CLOSED refuses', () => {
    expect(codeOf(() => assertFulfillmentTransition('CLOSED', 'CLOSED', { paymentStatus: 'PAID' }))).toBe(
      'ORDER_IMMUTABLE',
    );
    expect(codeOf(() => assertFulfillmentTransition('CANCELLED', 'CANCELLED', { paymentStatus: 'PAID' }))).toBe(
      'ORDER_IMMUTABLE',
    );
  });

  it('DELIVERED→CLOSED requires PAID; UNPAID and AWAITING_VERIFICATION both refuse', () => {
    expect(codeOf(() => assertFulfillmentTransition('DELIVERED', 'CLOSED', { paymentStatus: 'PAID' }))).toBeNull();
    expect(codeOf(() => assertFulfillmentTransition('DELIVERED', 'CLOSED', { paymentStatus: 'UNPAID' }))).toBe(
      'CLOSE_REQUIRES_PAID',
    );
    expect(
      codeOf(() => assertFulfillmentTransition('DELIVERED', 'CLOSED', { paymentStatus: 'AWAITING_VERIFICATION' })),
    ).toBe('CLOSE_REQUIRES_PAID');
  });

  it('RTO→CLOSED does NOT require payment (goods came back; COD never moved money)', () => {
    expect(codeOf(() => assertFulfillmentTransition('RTO', 'CLOSED', { paymentStatus: 'UNPAID' }))).toBeNull();
  });

  it('cancel window is exactly PLACED/PREPARING', () => {
    for (const s of FULFILLMENT_STATUSES) {
      expect(canCancel(s), `canCancel(${s})`).toBe(s === 'PLACED' || s === 'PREPARING');
      const cancelCode = codeOf(() => assertFulfillmentTransition(s, 'CANCELLED', { paymentStatus: 'UNPAID' }));
      if (s === 'PLACED' || s === 'PREPARING') expect(cancelCode).toBeNull();
      else expect(cancelCode).not.toBeNull();
    }
  });
});

describe('payment machine', () => {
  it('allows exactly its table (full 3×3 matrix); PAID is terminal', () => {
    for (const from of PAYMENT_STATUSES) {
      for (const to of PAYMENT_STATUSES) {
        const legal = PAYMENT_TRANSITIONS[from].includes(to);
        const code = codeOf(() => assertPaymentTransition(from, to));
        if (legal) expect(code, `${from}→${to}`).toBeNull();
        else expect(code, `${from}→${to}`).toBe('ILLEGAL_PAYMENT_TRANSITION');
      }
    }
  });

  it('UPI story: attest then reconcile — and a rejected claim falls back to UNPAID', () => {
    expect(codeOf(() => assertPaymentTransition('UNPAID', 'AWAITING_VERIFICATION'))).toBeNull();
    expect(codeOf(() => assertPaymentTransition('AWAITING_VERIFICATION', 'PAID'))).toBeNull();
    expect(codeOf(() => assertPaymentTransition('AWAITING_VERIFICATION', 'UNPAID'))).toBeNull();
    expect(codeOf(() => assertPaymentTransition('PAID', 'UNPAID'))).toBe('ILLEGAL_PAYMENT_TRANSITION');
  });

  it('payment methods are a closed set — no gateway ever sneaks in', () => {
    expect(() => assertPaymentMethod('COD')).not.toThrow();
    expect(() => assertPaymentMethod('UPI_QR')).not.toThrow();
    expect(codeOf(() => assertPaymentMethod('RAZORPAY'))).toBe('UNKNOWN_PAYMENT_METHOD');
  });
});

describe('GST re-derivation from inclusive prices', () => {
  it('matches the mix-engine goldens for premade shelf prices', () => {
    expect(gstSplitInclusive(93050, 500)).toEqual({ gstPaise: 4431, cgstPaise: 2215, sgstPaise: 2216 });
    expect(gstSplitInclusive(95000, 500)).toEqual({ gstPaise: 4524, cgstPaise: 2262, sgstPaise: 2262 });
    expect(gstSplitInclusive(123000, 500)).toEqual({ gstPaise: 5857, cgstPaise: 2928, sgstPaise: 2929 });
  });

  it('degenerate amounts stay exact', () => {
    expect(gstSplitInclusive(0, 500)).toEqual({ gstPaise: 0, cgstPaise: 0, sgstPaise: 0 });
    expect(gstSplitInclusive(100, 500)).toEqual({ gstPaise: 5, cgstPaise: 2, sgstPaise: 3 });
    const s = gstSplitInclusive(1, 500);
    expect(s.gstPaise).toBe(0);
    expect(s.cgstPaise + s.sgstPaise).toBe(s.gstPaise); // split always sums exactly
  });
});

describe('delivery credits', () => {
  const base = { subtotalPaise: 93050, deliveryFeePaise: 5000, creditsAvailable: 3 };
  it('charges the fee by default and adds it to the total', () => {
    const d = decideDelivery({ ...base, wantFreeDelivery: false });
    expect(d).toEqual({ deliveryPaise: 5000, deliveryWaived: false, totalPaise: 98050 });
  });
  it('waives exactly the fee when a credit is redeemed', () => {
    const d = decideDelivery({ ...base, wantFreeDelivery: true });
    expect(d).toEqual({ deliveryPaise: 0, deliveryWaived: true, totalPaise: 93050 });
  });
  it('refuses redemption without credit — never silently charges or silently waives', () => {
    expect(codeOf(() => decideDelivery({ ...base, creditsAvailable: 0, wantFreeDelivery: true }))).toBe(
      'CREDIT_NOT_AVAILABLE',
    );
    // …but the same customer CAN still order, just paying the fee
    expect(decideDelivery({ ...base, creditsAvailable: 0, wantFreeDelivery: false }).deliveryWaived).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Snapshot invariants                                                 */
/* ------------------------------------------------------------------ */

function goodSnapshot(over: Partial<OrderSnapshot> = {}): OrderSnapshot {
  const lines = [
    { name: 'Whole Wheat (Sharbati Gehu)', weightG: 7500, displayPercent: '75.00%', linePaise: 34500 },
    { name: 'Standard Desi Kala Chana', weightG: 1000, displayPercent: '10.00%', linePaise: 9200 },
    { name: 'Chia Seeds', weightG: 1500, displayPercent: '15.00%', linePaise: 19650 },
  ];
  const raw = lines.reduce((a, l) => a + l.linePaise, 0); // 63350
  const subtotal = raw + 4000 + 500; // + milling + packaging
  const gst = gstSplitInclusive(subtotal, 500);
  return {
    kind: 'LAB',
    packSizeG: 10000,
    packageCount: 1,
    lines,
    rawPaise: raw,
    millingPaise: 4000,
    packagingPaise: 500,
    subtotalPaise: subtotal,
    gstRateBps: 500,
    ...gst,
    deliveryFeePaise: 5000,
    deliveryPaise: 5000,
    deliveryWaived: false,
    totalPaise: subtotal + 5000,
    ratesProvisional: true,
    nutritionSources: ['IFCT2017', 'USDA'],
    ...over,
  };
}

describe('frozen snapshot invariants', () => {
  it('accepts a well-formed snapshot', () => {
    expect(() => assertSnapshotConsistent(goodSnapshot())).not.toThrow();
  });

  const tampers: Array<[string, Partial<OrderSnapshot>]> = [
    [
      'a line price off by 2 paise',
      { lines: [{ name: 'x', weightG: 10000, displayPercent: '100.00%', linePaise: 63352 }] },
    ],
    ['raw not equal to Σ lines', { rawPaise: 63351 }],
    ['milling skimmed by 1 paisa', { millingPaise: 3999 }],
    ['subtotal off by one', { subtotalPaise: 67851 }],
    ['CGST/SGST split skewed', { cgstPaise: 3227, sgstPaise: 3226 }],
    ['GST total tampered', { gstPaise: 3226 }],
    ['waived but delivery charged', { deliveryWaived: true }],
    ['charged but marked waived', { deliveryPaise: 0 }],
    ['total off by the delivery fee', { totalPaise: 67850 }],
    ['zero packages', { packageCount: 0 }],
    ['fractional packages', { packageCount: 1.5 }],
  ];
  for (const [label, over] of tampers) {
    it(`refuses ${label}`, () => {
      expect(codeOf(() => assertSnapshotConsistent(goodSnapshot(over)))).toBe('SNAPSHOT_INCONSISTENT');
    });
  }

  it('property: any snapshot built by the rules passes the checker (round-trip)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1_000_000 }), { minLength: 1, maxLength: 8 }), // lineAmounts
        fc.constantFrom(0, 500, 1200),
        fc.integer({ min: 0, max: 20000 }),
        fc.boolean(),
        fc.integer({ min: 1, max: 50 }),
        (lineAmounts, gstRateBps, deliveryFeePaise, waived, packageCount) => {
          const lines = lineAmounts.map((p, i) => ({
            name: `ing-${i}`,
            weightG: 1000 * (i + 1),
            displayPercent: '0.00%',
            linePaise: p,
          }));
          const raw = lines.reduce((a, l) => a + l.linePaise, 0);
          const milling = 400 * packageCount;
          const packaging = 500 * packageCount;
          const subtotal = raw + milling + packaging;
          const gst = gstSplitInclusive(subtotal, gstRateBps);
          const deliveryPaise = waived ? 0 : deliveryFeePaise;
          const snap: OrderSnapshot = {
            kind: 'LAB',
            packSizeG: 10000,
            packageCount,
            lines,
            rawPaise: raw,
            millingPaise: milling,
            packagingPaise: packaging,
            subtotalPaise: subtotal,
            gstRateBps,
            ...gst,
            deliveryFeePaise,
            deliveryPaise,
            deliveryWaived: waived,
            totalPaise: subtotal + deliveryPaise,
            ratesProvisional: false,
          };
          expect(() => assertSnapshotConsistent(snap)).not.toThrow();
          // and the classic invariants hold on top
          expect(snap.cgstPaise + snap.sgstPaise).toBe(snap.gstPaise);
          expect(snap.totalPaise).toBeGreaterThanOrEqual(snap.subtotalPaise);
        },
      ),
      { numRuns: 300 },
    );
  });
});
