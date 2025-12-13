CREATE TABLE product_purchase (
    id BIGSERIAL PRIMARY KEY,
    set_number BIGINT NOT NULL REFERENCES brick_set(number) ON DELETE CASCADE,
    web_store VARCHAR NOT NULL,
    price NUMERIC NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    purchased_at DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX idx_product_purchase_set ON product_purchase (set_number);
CREATE INDEX idx_product_purchase_store ON product_purchase (web_store);
CREATE INDEX idx_product_purchase_price ON product_purchase (price);
