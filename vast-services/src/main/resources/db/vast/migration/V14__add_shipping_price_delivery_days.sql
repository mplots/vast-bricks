-- How long the shipment takes, beside what it costs.
--
-- Two integers rather than the provider's own string. It states a range as "15 - 20" for some destinations and
-- "15-20" for others, and one of them carries a trailing space; stored as text, a day the provider reformats would
-- close every row and open an identical one. Parsed, only a real change is a change. A single estimate has the same
-- number in both columns, which is what "5" means when the provider writes it.
ALTER TABLE shipping_prices
    ADD COLUMN delivery_days_min INTEGER,
    ADD COLUMN delivery_days_max INTEGER;

COMMENT ON COLUMN shipping_prices.delivery_days_min IS
    'The fewest days the provider says this service takes to this destination. Null where it states no estimate.';
COMMENT ON COLUMN shipping_prices.delivery_days_max IS
    'The most days it says the same service takes. Equal to the minimum where the provider states one number rather than a range.';
