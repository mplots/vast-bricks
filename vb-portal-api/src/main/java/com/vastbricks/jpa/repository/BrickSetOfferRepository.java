package com.vastbricks.jpa.repository;

import com.vastbricks.jpa.entity.BrickSetOffer;

import com.vastbricks.jpa.projection.Upsert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface BrickSetOfferRepository extends JpaRepository<BrickSetOffer, Long> {

    @Query(value = """
        WITH u AS (
            UPDATE brick_set_offer SET
                price = :#{#offer.price},
                timestamp = :#{#offer.timestamp}
            WHERE id = (
                SELECT
                DISTINCT ON (product_id) id
                FROM brick_set_offer
                WHERE 
                  price = :#{#offer.price} AND product_id = :#{#offer.product.id}
                ORDER BY product_id, timestamp DESC    
            )
            RETURNING id, true as updated
        ), i AS (
            INSERT INTO brick_set_offer (
                    price,
                    timestamp,
                    product_id
                )
            SELECT
                :#{#offer.price},
                :#{#offer.timestamp},
                :#{#offer.product.id}
            WHERE NOT EXISTS (SELECT 1 FROM u)
            RETURNING id, false as updated
        )
        SELECT id, updated FROM u
        UNION ALL
        SELECT id, updated FROM i
    """, nativeQuery = true)
    Upsert upsert(@Param("offer") BrickSetOffer brickSetOffer);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
        UPDATE brick_set_offer
        SET active = FALSE
        WHERE price = :price
          AND product_id IN (
            SELECT id FROM product WHERE brick_set_number = :setNumber
        )
    """, nativeQuery = true)
    int deactivateBySetNumberAndPrice(@Param("setNumber") Long setNumber, @Param("price") BigDecimal price);
}
