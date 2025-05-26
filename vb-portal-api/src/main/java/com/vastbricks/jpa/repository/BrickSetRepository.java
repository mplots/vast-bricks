package com.vastbricks.jpa.repository;

import com.vastbricks.jpa.entity.BrickSet;
import com.vastbricks.jpa.projection.BestOffer;
import com.vastbricks.jpa.projection.Price;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Set;

public interface BrickSetRepository extends JpaRepository<BrickSet, Long> {


    List<BrickSet> findByNumberIn(Set<Long> numbers);

    @Query(value = "SELECT e.number FROM brick_set e", nativeQuery = true)
    List<String> findAllSetNumbers();

    @Query(value = """
        WITH lowest_offer AS (
            SELECT DISTINCT ON (brick_set_number)
                bso.price,
                bso.id,
                bso.timestamp,
                p.brick_set_number,
                bso.product_id
            FROM brick_set_offer bso
            JOIN product p ON bso.product_id = p.id
            WHERE timestamp >= NOW() - INTERVAL '3 hours'
            ORDER BY brick_set_number, price ASC 
        ), highest_part_out AS (
            SELECT DISTINCT ON (brick_set_number) *
            FROM brick_set_part_out_price
            ORDER BY brick_set_number, marketplace, timestamp, price DESC
        ), best_prices AS (
            SELECT
                lo.id as lowest_offer_id,
                bs.name as set_name,
                bs.number as set_number,
                bs.theme as theme,
                bs.pieces as pieces,
                bs.lots as lots,
                p.web_store as web_store,
                lo.price as price,
                ROUND(hpo.price, 2) as part_out_price,
                ROUND(hpo.price / lo.price, 2) as part_out_ratio,
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
            JOIN highest_part_out hpo ON hpo.brick_set_number = bs.number
            JOIN product p ON lo.product_id = p.id
        ) SELECT * FROM best_prices 
        WHERE 
            theme != 'Collectable Minifigures' AND (
                (:set IS NULL AND :ean IS NULL) OR 
                set_number = :set OR
                ean_ids @> ('["' || :ean || '"]')::jsonb
            )
        ORDER BY part_out_ratio DESC;
    """, nativeQuery = true)
    List<BestOffer> findBestOffers(@Param("set") Long set, @Param("ean") Long ean);


    @Query(value = """
        SELECT 
            a.id AS offer_id,
            a.web_store,
            TO_CHAR(
                    a.timestamp,
                    'YYYY-MM-DD HH24:MI:SS'
                ) AS timestamp,
            a.price
        FROM (
            SELECT DISTINCT ON (web_store) 
                 bso.id,
                 p.web_store,
                 bso.timestamp,
                 bso.price    
            FROM brick_set bs
            JOIN product p ON p.brick_set_number = bs.number
            JOIN brick_set_offer bso ON bso.product_id = p.id
            WHERE bs.number = :set
            ORDER BY web_store, timestamp DESC
        ) a ORDER BY price ASC;
    """, nativeQuery = true)
    List<Price> findSingleBestPrices(@Param("set") Long setNumber);

    @Query(value = """
        SELECT 
            bso.id AS offer_id,
            web_store,
            price,
            TO_CHAR(
                timestamp,
                'YYYY-MM-DD HH24:MI:SS'
            ) AS timestamp
        FROM brick_set_offer bso
        JOIN product p ON bso.product_id = p.id
        WHERE p.brick_set_number = :set AND p.web_store = :store ORDER BY timestamp DESC
    """, nativeQuery = true)
    List<Price> findPricesForStore(@Param("set") Long setNumber, @Param("store") String webStore);

}
