CREATE INDEX idx_bso_product_price ON brick_set_offer (product_id, price, timestamp);
CREATE INDEX idx_bso_timestamp ON brick_set_offer (timestamp);
CREATE INDEX idx_product_id_brick ON product (id, brick_set_number);
CREATE INDEX idx_price_distinct_sort ON brick_set_part_out_price (brick_set_number, marketplace, timestamp, price DESC);
