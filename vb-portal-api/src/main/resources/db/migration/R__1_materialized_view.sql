DROP MATERIALIZED VIEW IF EXISTS cheapest_offer_per_set;

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
    WHERE timestamp >= NOW() - ('${lowest_offer_interval}'::interval) AND p.active AND bso.active
    ORDER BY brick_set_number, price ASC
),
     all_time_lowest_offer AS (
         SELECT DISTINCT ON (brick_set_number)
             bso.price,
             bso.id,
             bso.timestamp,
             p.brick_set_number,
             bso.product_id,
             p.web_store
         FROM brick_set_offer bso
                  JOIN product p ON bso.product_id = p.id
         WHERE bso.active
         ORDER BY brick_set_number, price ASC
     ),
     latest_part_out AS (
         SELECT DISTINCT ON (brick_set_number) *
         FROM brick_set_part_out_price
         ORDER BY brick_set_number, marketplace, timestamp DESC
     ), lowest_purchase AS (
         SELECT
             set_number,
             MIN(price) AS lowest_purchase_price
         FROM product_purchase
         GROUP BY set_number
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
        atlo.web_store as lowest_price_web_store,
        atlo.timestamp as lowest_price_timestamp,
        TO_CHAR(atlo.timestamp, 'YYYY-MM-DD') as lowest_price_date,
        FLOOR(EXTRACT(EPOCH FROM (NOW() - atlo.timestamp)) / 86400) :: INT AS lowest_price_age_days,
        ROUND(hpo.price, 2) as part_out_price,
        CASE WHEN lo.price = 0 THEN 0 ELSE ROUND(hpo.price / lo.price, 2) END AS part_out_ratio,
        CASE WHEN bs.pieces = 0 THEN 0 ELSE ROUND(lo.price / COALESCE(bs.pieces, 1), 3) END AS price_peer_peace,
        p.image as image,
        p.link as purchase_link,
        hpo.link as part_out_link,
        ean_ids as ean_ids,
        TO_CHAR(
                lo.timestamp,
                'YYYY-MM-DD HH24:MI:SS'
        ) AS price_timestamp,
        lp.lowest_purchase_price as lowest_purchase_price
    FROM brick_set bs
             JOIN lowest_offer lo ON lo.brick_set_number = bs.number
             JOIN all_time_lowest_offer atlo ON atlo.brick_set_number = bs.number
             JOIN latest_part_out hpo ON hpo.brick_set_number = bs.number
             JOIN product p ON lo.product_id = p.id
             LEFT JOIN lowest_purchase lp ON lp.set_number = bs.number
) SELECT * FROM best_prices
ORDER BY part_out_ratio DESC
;

CREATE UNIQUE INDEX cheapest_offer_per_set_idx ON cheapest_offer_per_set(set_number);
