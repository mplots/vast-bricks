package com.vastbricks.jpa.repository;

import com.vastbricks.jpa.entity.BrickSetOffer;
import com.vastbricks.jpa.entity.OwlWebSetInventory;
import com.vastbricks.jpa.entity.Product;
import com.vastbricks.jpa.projection.Upsert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductRepository extends JpaRepository<OwlWebSetInventory, Integer> {

    @Query(value = """
        WITH u AS (
            UPDATE product SET
                name = :#{#product.name},
                image = :#{#product.image}
            WHERE link = :#{#product.link} AND 
                  brick_set_number = :#{#product.brickSet.number} AND
                  web_store = :#{#product.webStore}
            RETURNING id, true as updated
        ), i AS (
            INSERT INTO product (
                name,
                image,
                link,
                brick_set_number,
                web_store
            )
            SELECT
                :#{#product.name},
                :#{#product.image},
                :#{#product.link},
                :#{#product.brickSet.number},
                :#{#product.webStore}
            WHERE NOT EXISTS (SELECT 1 FROM u)
            RETURNING id, false as updated
        )
        SELECT id, updated FROM u
        UNION ALL
        SELECT id, updated FROM i
    """, nativeQuery = true)
    Upsert upsert(@Param("product") Product product);
}
