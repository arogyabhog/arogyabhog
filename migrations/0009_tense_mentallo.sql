CREATE TABLE `referral_credit_accounts` (
	`store_id` text NOT NULL,
	`user_id` text NOT NULL,
	`awards_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`store_id`, `user_id`),
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "referral_credit_accounts_nonnegative" CHECK("referral_credit_accounts"."awards_count" >= 0)
);
