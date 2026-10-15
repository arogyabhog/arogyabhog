CREATE TABLE `referrals` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`referrer_user_id` text NOT NULL,
	`referee_user_id` text NOT NULL,
	`referral_code` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`signup_device_hash` text,
	`credited_order_id` text,
	`credit_awarded` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`referrer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`referee_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`credited_order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "referrals_status_valid" CHECK("referrals"."status" IN ('PENDING', 'CREDITED', 'CAPPED')),
	CONSTRAINT "referrals_not_self" CHECK("referrals"."referrer_user_id" <> "referrals"."referee_user_id"),
	CONSTRAINT "referrals_state_consistent" CHECK(("referrals"."status" = 'PENDING' AND "referrals"."credited_order_id" IS NULL AND "referrals"."credit_awarded" = 0) OR ("referrals"."status" = 'CREDITED' AND "referrals"."credited_order_id" IS NOT NULL AND "referrals"."credit_awarded" = 1) OR ("referrals"."status" = 'CAPPED' AND "referrals"."credited_order_id" IS NOT NULL AND "referrals"."credit_awarded" = 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referrals_referee_unique` ON `referrals` (`referee_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `referrals_credited_order_unique` ON `referrals` (`credited_order_id`);--> statement-breakpoint
CREATE INDEX `referrals_store_status_time` ON `referrals` (`store_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `referrals_device_store` ON `referrals` (`store_id`,`signup_device_hash`);