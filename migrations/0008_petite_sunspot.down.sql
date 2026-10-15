-- Destructive rollback: removes referral attribution, award outcomes, and hashed signup-device signals.
DROP INDEX IF EXISTS `referrals_device_store`;
DROP INDEX IF EXISTS `referrals_store_status_time`;
DROP INDEX IF EXISTS `referrals_credited_order_unique`;
DROP INDEX IF EXISTS `referrals_referee_unique`;
DROP TABLE IF EXISTS `referrals`;
