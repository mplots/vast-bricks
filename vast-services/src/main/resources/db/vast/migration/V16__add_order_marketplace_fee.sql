-- The marketplace's own account of its commission on the order: BrickOwl states one, BrickLink none. What this
-- store calculates the same commission as is not stored - it is worked out from this row's own amounts when the
-- order is read, exactly as the target invoice is, rather than a calculated figure riding in the row until the
-- schedule it was calculated under changes.
ALTER TABLE orders ADD COLUMN marketplace_fee NUMERIC(19, 2);

COMMENT ON COLUMN orders.marketplace_fee IS
    'The marketplace''s own account of its commission on the order: BrickOwl''s brickowl_fee, or null for BrickLink, which states none.';
