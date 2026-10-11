CREATE TABLE `ingredient_price_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`store_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`cost_paise_per_kg` integer NOT NULL,
	`sell_paise_per_kg` integer NOT NULL,
	`cost_source` text NOT NULL,
	`sell_source` text NOT NULL,
	`rates_provisional` integer NOT NULL,
	`actor_user_id` text,
	`changed_at` integer NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ingredient_price_history_cost_positive" CHECK("ingredient_price_history"."cost_paise_per_kg" > 0),
	CONSTRAINT "ingredient_price_history_sell_positive" CHECK("ingredient_price_history"."sell_paise_per_kg" > 0)
);
--> statement-breakpoint
CREATE INDEX `ingredient_price_history_store_item_time` ON `ingredient_price_history` (`store_id`,`ingredient_id`,`changed_at`);--> statement-breakpoint
ALTER TABLE `stores` ADD `price_consistency_tolerance_bps` integer DEFAULT 500 NOT NULL;
--> statement-breakpoint
INSERT INTO `ingredient_price_history` (
  `store_id`, `ingredient_id`, `cost_paise_per_kg`, `sell_paise_per_kg`,
  `cost_source`, `sell_source`, `rates_provisional`, `actor_user_id`, `changed_at`
)
SELECT `store_id`, `id`, `cost_paise_per_kg`, `sell_paise_per_kg`,
  `cost_source`, `sell_source`, `rates_provisional`, NULL, `updated_at`
FROM `ingredients`;