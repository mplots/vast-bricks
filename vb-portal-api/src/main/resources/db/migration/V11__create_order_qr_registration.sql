CREATE TABLE order_qr_registration (
    id SERIAL NOT NULL PRIMARY KEY,
    qrid VARCHAR NOT NULL UNIQUE,
    order_id VARCHAR NOT NULL,
    source VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
