package com.vastbricks.jpa.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface PartUsageRepository extends Repository<com.vastbricks.jpa.entity.BrickSet, Long> {

    @Query(value = """
        WITH latest_inventory AS (
            SELECT DISTINCT ON (i.set_num) i.id, i.set_num
            FROM rebrickable.inventories i
            ORDER BY i.set_num, i.version DESC
        ),
        matches AS (
            SELECT li.set_num,
                   ip.quantity AS part_qty
            FROM rebrickable.inventory_parts ip
            JOIN latest_inventory li ON li.id = ip.inventory_id
            JOIN rebrickable_color_map m ON m.rebrickable_color_id = ip.color_id
            WHERE ip.is_spare = false
              AND ip.part_num = :partNum
              AND m.bricklink_color_id = :colorId
        )
        SELECT bs.number AS setNumber,
               bs.name AS setName,
               m.part_qty AS partQty,
               co.part_out_price AS partOutPrice,
               co.part_out_ratio AS partOutRatio,
               co.part_out_link AS partOutLink,
               co.price AS setPrice,
               co.web_store AS webStore,
               co.image AS image
        FROM matches m
        JOIN brick_set bs ON bs.number::text = split_part(m.set_num, '-', 1)
        JOIN cheapest_offer_per_set co ON co.set_number = bs.number
        ORDER BY
                 CASE WHEN :sort = 'ratio' AND :dir = 'desc' THEN co.part_out_ratio END DESC NULLS LAST,
                 CASE WHEN :sort = 'ratio' AND :dir = 'asc' THEN co.part_out_ratio END ASC NULLS LAST,
                 CASE WHEN :sort = 'qty' AND :dir = 'desc' THEN m.part_qty END DESC NULLS LAST,
                 CASE WHEN :sort = 'qty' AND :dir = 'asc' THEN m.part_qty END ASC NULLS LAST,
                 CASE WHEN :sort = 'price' AND :dir = 'desc' THEN co.price END DESC NULLS LAST,
                 CASE WHEN :sort = 'price' AND :dir = 'asc' THEN co.price END ASC NULLS LAST,
                 CASE WHEN :sort = 'partout' AND :dir = 'desc' THEN co.part_out_price END DESC NULLS LAST,
                 CASE WHEN :sort = 'partout' AND :dir = 'asc' THEN co.part_out_price END ASC NULLS LAST,
                 co.part_out_ratio DESC NULLS LAST,
                 m.part_qty DESC,
                 bs.number ASC
        LIMIT :limit OFFSET :offset
        """, nativeQuery = true)
    List<PartUsageRow> findTopUsage(@Param("partNum") String partNum,
                                    @Param("colorId") Integer colorId,
                                    @Param("limit") int limit,
                                    @Param("offset") int offset,
                                    @Param("sort") String sort,
                                    @Param("dir") String dir);

    @Query(value = """
        WITH latest_inventory AS (
            SELECT DISTINCT ON (i.set_num) i.id, i.set_num
            FROM rebrickable.inventories i
            ORDER BY i.set_num, i.version DESC
        ),
        matches AS (
            SELECT li.set_num
            FROM rebrickable.inventory_parts ip
            JOIN latest_inventory li ON li.id = ip.inventory_id
            JOIN rebrickable_color_map m ON m.rebrickable_color_id = ip.color_id
            WHERE ip.is_spare = false
              AND ip.part_num = :partNum
              AND m.bricklink_color_id = :colorId
        )
        SELECT COUNT(*)
        FROM matches m
        JOIN brick_set bs ON bs.number::text = split_part(m.set_num, '-', 1)
        JOIN cheapest_offer_per_set co ON co.set_number = bs.number
        """, nativeQuery = true)
    long countTopUsage(@Param("partNum") String partNum,
                       @Param("colorId") Integer colorId);

    interface PartUsageRow {
        Long getSetNumber();
        String getSetName();
        Integer getPartQty();
        BigDecimal getPartOutPrice();
        BigDecimal getPartOutRatio();
        String getPartOutLink();
        BigDecimal getSetPrice();
        String getWebStore();
        String getImage();
    }
}
