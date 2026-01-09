CREATE TABLE bsx_document (
    id BIGSERIAL PRIMARY KEY,
    filename VARCHAR NOT NULL,
    imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_bsx_document_filename ON bsx_document (filename);
CREATE TABLE bsx_order (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES bsx_document(id) ON DELETE CASCADE,
    service VARCHAR,
    order_id VARCHAR,
    order_date BIGINT,
    customer VARCHAR,
    sub_total NUMERIC,
    grand_total NUMERIC,
    payment NUMERIC,
    currency VARCHAR
);

CREATE UNIQUE INDEX idx_bsx_order_document ON bsx_order (document_id);

CREATE TABLE bsx_item (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES bsx_document(id) ON DELETE CASCADE,
    item_id VARCHAR,
    item_type_id VARCHAR,
    color_id INTEGER,
    item_name VARCHAR,
    item_type_name VARCHAR,
    color_name VARCHAR,
    status VARCHAR,
    qty INTEGER,
    orig_qty INTEGER,
    price NUMERIC,
    sale_price NUMERIC,
    condition VARCHAR,
    remarks TEXT,
    lot_id VARCHAR
);

CREATE INDEX idx_bsx_item_document ON bsx_item (document_id);
CREATE INDEX idx_bsx_item_item_id ON bsx_item (item_id);
