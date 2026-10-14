CREATE TABLE `coupon_redemptions` (
	`coupon_id` text NOT NULL,
	`order_id` text NOT NULL,
	`user_id` text NOT NULL,
	`discount_paise` integer NOT NULL,
	`redeemed_at` integer NOT NULL,
	PRIMARY KEY(`coupon_id`, `order_id`),
	FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "coupon_redemptions_discount_nonnegative" CHECK("coupon_redemptions"."discount_paise" >= 0)
);
--> statement-breakpoint
CREATE INDEX `coupon_redemptions_coupon_user` ON `coupon_redemptions` (`coupon_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`code` text NOT NULL,
	`type` text NOT NULL,
	`value` integer NOT NULL,
	`min_order_paise` integer,
	`max_discount_paise` integer,
	`usage_limit` integer,
	`per_user_limit` integer,
	`starts_at` integer,
	`expires_at` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "coupons_type_valid" CHECK("coupons"."type" IN ('PERCENT', 'FLAT', 'FREE_DELIVERY')),
	CONSTRAINT "coupons_value_nonnegative" CHECK("coupons"."value" >= 0),
	CONSTRAINT "coupons_minimum_nonnegative" CHECK("coupons"."min_order_paise" IS NULL OR "coupons"."min_order_paise" >= 0),
	CONSTRAINT "coupons_usage_limit_positive" CHECK("coupons"."usage_limit" IS NULL OR "coupons"."usage_limit" > 0),
	CONSTRAINT "coupons_per_user_limit_positive" CHECK("coupons"."per_user_limit" IS NULL OR "coupons"."per_user_limit" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_store_code_unique` ON `coupons` (`store_id`,`code`);--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `coupon_id` text REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `coupon_code_used` text;--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `coupon_type` text;--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `coupon_discount_paise` integer DEFAULT 0 NOT NULL;
