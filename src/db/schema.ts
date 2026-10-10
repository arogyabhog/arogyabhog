/**
 * Drizzle schema — SQLite dialect (libSQL in dev/tests, Neon Postgres later via
 * dialect swap per ADR-004/019/024). Integer discipline (R1) everywhere:
 * money in paise, weights in grams, ratios in basis points, nutrients ×100.
 *
 * Vertical-slice subset of `.project-os/04_DATABASE_SCHEMA.md`: everything the
 * Lab calculate endpoint and premade PDPs need. Orders/payments/referrals land
 * in the next increment.
 */
import { sql } from 'drizzle-orm';
import { check, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const stores = sqliteTable('stores', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  city: text('city').notNull(),
  status: text('status').notNull().default('active'),
  /** JSON array of valid custom-mix weights in grams. Mixes allow 5 kg (ADR-021). */
  allowedPackSizesG: text('allowed_pack_sizes_g').notNull(),
  minBaseGrainBps: integer('min_base_grain_bps').notNull().default(6000),
  millingFeePaisePerKg: integer('milling_fee_paise_per_kg').notNull(),
  packagingFeePaise: integer('packaging_fee_paise').notNull(),
  deliveryFeePaise: integer('delivery_fee_paise').notNull(),
  /** 5% = 500. Displayed prices are GST-inclusive (ADR-009); CA-editable. */
  gstRateBps: integer('gst_rate_bps').notNull().default(500),
  referralCreditCap: integer('referral_credit_cap').notNull().default(10),
  refereeBonusCredits: integer('referee_bonus_credits').notNull().default(1),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at')
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  /** ADMIN (global) | MANAGER (store-scoped) | CUSTOMER. Enforced server-side (ADR-014). */
  role: text('role').notNull(),
  storeId: text('store_id').references(() => stores.id),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  referralCode: text('referral_code').notNull().unique(),
  /** Stable code of the referrer; self-referral blocked in service layer (ADR-017). */
  referredByCode: text('referred_by_code'),
  freeDeliveryCredits: integer('free_delivery_credits').notNull().default(1),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const ingredients = sqliteTable(
  'ingredients',
  {
    id: text('id').primaryKey(), // RM-001 …
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    name: text('name').notNull(),
    category: text('category'),
    isBaseGrain: integer('is_base_grain', { mode: 'boolean' }).notNull().default(false),
    /** Per-ingredient cap in bps; null = uncapped (ADR-013). */
    maxPctBps: integer('max_pct_bps'),
    costPaisePerKg: integer('cost_paise_per_kg').notNull(),
    sellPaisePerKg: integer('sell_paise_per_kg').notNull(),
    costSource: text('cost_source').notNull(),
    sellSource: text('sell_source').notNull(),
    /** Provisional seed rates show an "indicative pricing" chip (ADR-026). */
    ratesProvisional: integer('rates_provisional', { mode: 'boolean' }).notNull().default(true),
    reviewNote: text('review_note'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (t) => [
    // R1.3 at the storage layer: a zero or negative rate must be impossible to
    // store, not merely refused by the API.
    check('ingredients_cost_positive', sql`${t.costPaisePerKg} > 0`),
    check('ingredients_sell_positive', sql`${t.sellPaisePerKg} > 0`),
  ],
);

/** EAV nutrition: one row per (ingredient, nutrient). Values ×100 (R1). */
export const ingredientNutrition = sqliteTable(
  'ingredient_nutrition',
  {
    ingredientId: text('ingredient_id')
      .notNull()
      .references(() => ingredients.id, { onDelete: 'cascade' }),
    nutrientKey: text('nutrient_key').notNull(), // enerc, protcnt, fibtg, …
    valueX100: integer('value_x100').notNull(),
    /** One source per nutrient, never two (ADR-007). */
    source: text('source').notNull(),
    sourceCode: text('source_code'), // IFCT code e.g. A019
  },
  (t) => [primaryKey({ columns: [t.ingredientId, t.nutrientKey] })],
);

/** Product names are content, never enums (ADR-020): the client renames freely. */
export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  storeId: text('store_id')
    .notNull()
    .references(() => stores.id),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  status: text('status').notNull().default('active'),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at')
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const productVariants = sqliteTable(
  'product_variants',
  {
    /** Surrogate id kept unique; the real PK is (productId, packSizeG) below —
     *  SQLite forbids two primary keys per table. */
    id: text('id').notNull().unique(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    packSizeG: integer('pack_size_g').notNull(),
    costPaise: integer('cost_paise').notNull(),
    sellPaise: integer('sell_paise').notNull(),
    sellSource: text('sell_source').notNull(),
    provisional: integer('provisional', { mode: 'boolean' }).notNull().default(false),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.productId, t.packSizeG] })],
);

/** Premade composition in bps — powers exact-% disclosure on PDPs (research L1). */
export const productRecipeLines = sqliteTable(
  'product_recipe_lines',
  {
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    ingredientId: text('ingredient_id')
      .notNull()
      .references(() => ingredients.id),
    ratioBps: integer('ratio_bps').notNull(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.ingredientId] })],
);

/** Mandatory audit trail (ADR-015): who changed what, with before/after. */
export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  actorUserId: text('actor_user_id'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  beforeJson: text('before_json'),
  afterJson: text('after_json'),
  at: integer('at')
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type StoreRow = typeof stores.$inferSelect;
export type IngredientRow = typeof ingredients.$inferSelect;
