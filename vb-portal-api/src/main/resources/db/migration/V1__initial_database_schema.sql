CREATE TYPE marketplace AS ENUM ('BRICK_OWL', 'BRICK_LINK');
CREATE TYPE web_store AS ENUM ('IIZII','_1A','RD_ELECTRONIC','DIGIMART', 'MAXTRADE');

CREATE TABLE system_web_store (
    id WEB_STORE NOT NULL PRIMARY KEY,
    name VARCHAR NOT NULL
);


INSERT INTO system_web_store (id, name) VALUES ('IIZII', 'iizii');
INSERT INTO system_web_store (id, name) VALUES ('_1A', '1a');
INSERT INTO system_web_store (id, name) VALUES ('RD_ELECTRONIC', 'RD Electronic');
INSERT INTO system_web_store (id, name) VALUES ('DIGIMART', 'Digimart');


CREATE TABLE brick_set (
    number BIGINT NOT NULL PRIMARY KEY,
    name VARCHAR not null,
    theme VARCHAR NOT NULL,
    boid VARCHAR NOT NULL,
    ean_ids jsonb NOT NULL,
    upc_ids jsonb NOT NULL
);

CREATE TABLE brick_set_offer (
    id SERIAL NOT NULL PRIMARY KEY,
    price NUMERIC NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    image VARCHAR NOT NULL,
    purchase_link VARCHAR NOT NULL,
    web_store VARCHAR NOT NULL,
    brick_set_number BIGINT REFERENCES brick_set(number) ON DELETE CASCADE,
    UNIQUE (price, web_store, brick_set_number)
);

CREATE TABLE brick_set_part_out_price (
    id SERIAL NOT NULL PRIMARY KEY,
    price NUMERIC NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    marketplace VARCHAR NOT NULL,
    link VARCHAR NOT NULL,
    brick_set_number BIGINT REFERENCES brick_set(number) ON DELETE CASCADE,
    UNIQUE (price, marketplace, brick_set_number)
);


CREATE TABLE owl_set (
    boid VARCHAR NOT NULL PRIMARY KEY,
    contents jsonb NOT NULL
);

CREATE TABLE owl_web_set_inventory (
    boid VARCHAR NOT NULL PRIMARY KEY,
    contents jsonb NOT NULL,
    owl_set_boid VARCHAR REFERENCES owl_set(boid) ON DELETE CASCADE
);

CREATE INDEX owl_set_contents_ix ON owl_set USING gin (
    contents pg_catalog.jsonb_path_ops
);

CREATE INDEX owl_web_set_inventory_contents_ix ON owl_web_set_inventory USING gin (
    contents pg_catalog.jsonb_path_ops
);

CREATE INDEX brick_set_ean_ids_ix ON brick_set USING GIN (ean_ids);
CREATE INDEX brick_set_upc_ids_ix ON brick_set USING GIN (upc_ids);




