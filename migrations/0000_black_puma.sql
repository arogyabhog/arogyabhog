CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ingredient_nutrition` (
	`ingredient_id` text NOT NULL,
	`nutrient_key` text NOT NULL,
	`value_x100` integer NOT NULL,
	`source` text NOT NULL,
	`source_code` text,
	PRIMARY KEY(`ingredient_id`, `nutrient_key`),
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`is_base_grain` integer DEFAULT false NOT NULL,
	`max_pct_bps` integer,
	`cost_paise_per_kg` integer NOT NULL,
	`sell_paise_per_kg` integer NOT NULL,
	`cost_source` text NOT NULL,
	`sell_source` text NOT NULL,
	`rates_provisional` integer DEFAULT true NOT NULL,
	`review_note` text,
	`active` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ingredients_cost_positive" CHECK("ingredients"."cost_paise_per_kg" > 0),
	CONSTRAINT "ingredients_sell_positive" CHECK("ingredients"."sell_paise_per_kg" > 0)
);
--> statement-breakpoint
CREATE TABLE `product_recipe_lines` (
	`product_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`ratio_bps` integer NOT NULL,
	PRIMARY KEY(`product_id`, `ingredient_id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` text NOT NULL,
	`product_id` text NOT NULL,
	`pack_size_g` integer NOT NULL,
	`cost_paise` integer NOT NULL,
	`sell_paise` integer NOT NULL,
	`sell_source` text NOT NULL,
	`provisional` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	PRIMARY KEY(`product_id`, `pack_size_g`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_variants_id_unique` ON `product_variants` (`id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stores` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`city` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`allowed_pack_sizes_g` text NOT NULL,
	`min_base_grain_bps` integer DEFAULT 6000 NOT NULL,
	`milling_fee_paise_per_kg` integer NOT NULL,
	`packaging_fee_paise` integer NOT NULL,
	`delivery_fee_paise` integer NOT NULL,
	`gst_rate_bps` integer DEFAULT 500 NOT NULL,
	`referral_credit_cap` integer DEFAULT 10 NOT NULL,
	`referee_bonus_credits` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`store_id` text,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text,
	`referral_code` text NOT NULL,
	`referred_by_code` text,
	`free_delivery_credits` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_referral_code_unique` ON `users` (`referral_code`);