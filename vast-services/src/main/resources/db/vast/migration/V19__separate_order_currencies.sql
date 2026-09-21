ALTER TABLE vast.orders ADD COLUMN base_currency VARCHAR(3);
ALTER TABLE vast.orders ADD COLUMN refund_currency VARCHAR(3);
ALTER TABLE vast.orders ADD COLUMN currency_version INTEGER NOT NULL DEFAULT 0;
-- Existing amounts cannot be relabelled safely in SQL. The next archive import rereads version-zero rows.
