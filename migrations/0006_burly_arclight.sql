CREATE TABLE `inventory_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`store_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`delta_g` integer NOT NULL,
	`reason` text NOT NULL,
	`order_id` text,
	`note` text,
	`actor_user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "inventory_movements_nonzero_delta" CHECK("inventory_movements"."delta_g" <> 0),
	CONSTRAINT "inventory_movements_reason_valid" CHECK("inventory_movements"."reason" IN ('PURCHASE', 'CONSUMED_BY_ORDER', 'WASTAGE', 'ADJUSTMENT', 'RETURN_TO_STOCK'))
);
--> statement-breakpoint
CREATE INDEX `inventory_movements_store_ingredient_time` ON `inventory_movements` (`store_id`,`ingredient_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `inventory_movements_order` ON `inventory_movements` (`order_id`);