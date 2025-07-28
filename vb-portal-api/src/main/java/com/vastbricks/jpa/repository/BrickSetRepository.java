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
      SELECT DISTINCT ON (theme) theme FROM brick_set; 
    """, nativeQuery = true)
    List<String> getAllThemes();

    @Query(value = """
        SELECT * FROM cheapest_offer_per_set 
        WHERE 
            theme != 'Collectable Minifigures' AND (
                (:set IS NULL AND :ean IS NULL) OR 
                set_number = :set OR
                ean_ids @> ('["' || :ean || '"]')::jsonb
            ) AND (
                NOT :atl OR price = lowest_price
            ) AND (
                CAST(:stores AS TEXT) IS NULL OR web_store IN (:stores)
            ) AND (
                CAST(:themes AS TEXT) IS NULL OR theme IN (:themes)
            )
        ORDER BY part_out_ratio DESC
        LIMIT :limit
        ;
    """, nativeQuery = true)
    List<BestOffer> findBestOffers(@Param("limit") Integer limit,
                                   @Param("set") Long set,
                                   @Param("ean") Long ean,
                                   @Param("atl") Boolean atl,
                                   @Param("stores") String[] stores,
                                   @Param("themes") String[] themes);

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
