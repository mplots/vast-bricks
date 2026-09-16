-- Where the order went, which the marketplaces state as a two-letter code on the address they shipped it to.
ALTER TABLE orders ADD COLUMN country VARCHAR(2);

COMMENT ON COLUMN orders.country IS
    'The country the order was shipped to, as a two-letter code: BrickLink''s shipping address country_code, BrickOwl''s ship_country_code. Null where the archive holds no file that states an address.';
