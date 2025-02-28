CREATE TABLE product (
    id BIGSERIAL NOT NULL PRIMARY KEY,
    name VARCHAR NOT NULL,
    link VARCHAR NOT NULL,
    image VARCHAR NOT NULL,
    web_store VARCHAR NOT NULL,
    brick_set_number BIGINT REFERENCES brick_set(number),
    UNIQUE(link, brick_set_number, web_store)
);

INSERT INTO product (name, link, image, web_store, brick_set_number)
SELECT bs.name, bso.purchase_link, bso.image, bso.web_store, bso.brick_set_number
FROM brick_set_offer bso
         JOIN brick_set bs ON bso.brick_set_number = bs.number
ON CONFLICT (link, brick_set_number, web_store) DO NOTHING;

ALTER TABLE brick_set_offer ADD COLUMN product_id BIGINT REFERENCES product(id);

UPDATE brick_set_offer o
SET product_id = p.id
FROM product p
WHERE o.purchase_link = p.link;

ALTER TABLE brick_set_offer ALTER COLUMN product_id SET NOT NULL;

ALTER TABLE brick_set_offer DROP COLUMN image;
ALTER TABLE brick_set_offer DROP COLUMN purchase_link;
ALTER TABLE brick_set_offer DROP COLUMN web_store;
ALTER TABLE brick_set_offer DROP COLUMN brick_set_number;
