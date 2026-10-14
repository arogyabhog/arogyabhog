-- Destructive rollback: removes coupon definitions, uses, and order discount snapshots.
DROP INDEX IF EXISTS `coupon_redemptions_coupon_user`;
DROP TABLE IF EXISTS `coupon_redemptions`;
ALTER TABLE `orders` DROP COLUMN `coupon_discount_paise`;
ALTER TABLE `orders` DROP COLUMN `coupon_type`;
ALTER TABLE `orders` DROP COLUMN `coupon_code_used`;
ALTER TABLE `orders` DROP COLUMN `coupon_id`;
DROP INDEX IF EXISTS `coupons_store_code_unique`;
DROP TABLE IF EXISTS `coupons`;
