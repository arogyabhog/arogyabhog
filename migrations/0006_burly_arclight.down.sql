-- Destructive rollback: removes the raw-ingredient movement ledger and all recorded stock history.
DROP INDEX IF EXISTS `inventory_movements_order`;
DROP INDEX IF EXISTS `inventory_movements_store_ingredient_time`;
DROP TABLE IF EXISTS `inventory_movements`;
