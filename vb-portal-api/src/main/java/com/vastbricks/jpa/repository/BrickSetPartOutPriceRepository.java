package com.vastbricks.jpa.repository;

import com.vastbricks.jpa.entity.BrickSetPartOutPrice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BrickSetPartOutPriceRepository extends JpaRepository<BrickSetPartOutPrice, Long> {

    @Query(value = """
        INSERT INTO brick_set_part_out_price (
            price, 
            timestamp,
            marketplace,
            link,
            brick_set_number
        )
        VALUES (
            :#{#partOut.price},
            :#{#partOut.timestamp},
            :#{#partOut.marketplace},
            :#{#partOut.link},
            :#{#partOut.brickSet.number}
        )
        ON CONFLICT (price, marketplace, brick_set_number)
        DO UPDATE SET
            price = excluded.price,
            timestamp = excluded.timestamp,
            marketplace = excluded.marketplace,
            link = excluded.link,
            brick_set_number = excluded.brick_set_number
        RETURNING id
    """, nativeQuery = true)
    Long upsert(@Param("partOut") BrickSetPartOutPrice brickSetPartOutPrice);
}
