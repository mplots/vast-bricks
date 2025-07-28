DROP MATERIALIZED VIEW cheapest_offer_per_set;

CREATE MATERIALIZED VIEW cheapest_offer_per_set  AS
WITH lowest_offer AS (
    SELECT DISTINCT ON (brick_set_number)
        bso.price,
        bso.id,
        bso.timestamp,
        p.brick_set_number,
        bso.product_id
    FROM brick_set_offer bso
             JOIN product p ON bso.product_id = p.id
    WHERE timestamp >= NOW() - INTERVAL '3 hours' AND p.active
    ORDER BY brick_set_number, price ASC
),
     all_time_lowest_offer AS (
         SELECT DISTINCT ON (brick_set_number)
             bso.price,
             bso.id,
             bso.timestamp,
             p.brick_set_number,
             bso.product_id
         FROM brick_set_offer bso
                  JOIN product p ON bso.product_id = p.id
         ORDER BY brick_set_number, price ASC
     ),
     latest_part_out AS (
         SELECT DISTINCT ON (brick_set_number) *
         FROM brick_set_part_out_price
         ORDER BY brick_set_number, marketplace, timestamp DESC
     ), best_prices AS (
    SELECT
        lo.id as lowest_offer_id,
        bs.name as set_name,
        bs.number as set_number,
        bs.theme as theme,
        bs.pieces as pieces,
        bs.lots as lots,
        p.id as product_id,
        p.web_store as web_store,
        lo.price as price,
        atlo.price as lowest_price,
        ROUND(hpo.price, 2) as part_out_price,
        ROUND(hpo.price / lo.price, 2) as part_out_ratio,
        ROUND(lo.price / COALESCE(bs.pieces, 1), 3) as price_peer_peace,
        p.image as image,
        p.link as purchase_link,
        hpo.link as part_out_link,
        ean_ids as ean_ids,
        TO_CHAR(
                lo.timestamp,
                'YYYY-MM-DD HH24:MI:SS'
        ) AS price_timestamp
    FROM brick_set bs
             JOIN lowest_offer lo ON lo.brick_set_number = bs.number
             JOIN all_time_lowest_offer atlo ON atlo.brick_set_number = bs.number
             JOIN latest_part_out hpo ON hpo.brick_set_number = bs.number
             JOIN product p ON lo.product_id = p.id
) SELECT * FROM best_prices
ORDER BY part_out_ratio DESC
;

CREATE UNIQUE INDEX cheapest_offer_per_set_idx ON cheapest_offer_per_set(set_number);
