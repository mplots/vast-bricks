package com.vastbricks.jpa.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface InventoryRepository extends Repository<com.vastbricks.jpa.entity.BrickSet, Long> {

    @Query(value = """
        WITH inventory_items AS (
            SELECT bi.item_id AS part_num,
                   bi.color_id AS color_id,
                   MAX(bi.item_name) AS item_name,
                   MAX(bi.color_name) AS color_name,
                   SUM(bi.qty) AS remaining_qty
            FROM bsx_item bi
            JOIN bsx_document bd ON bd.id = bi.document_id
            WHERE bd.document_type = 'INVENTORY'
              AND bd.filename = :filename
              AND bi.item_type_id = 'P'
            GROUP BY bi.item_id, bi.color_id
        ),
        sold_items AS (
            SELECT bi.item_id AS part_num,
                   bi.color_id AS color_id,
                   MAX(bi.item_name) AS item_name,
                   MAX(bi.color_name) AS color_name,
                   SUM(bi.qty) AS sold_qty,
                   COUNT(DISTINCT bo.order_id) AS order_count
            FROM bsx_item bi
            JOIN bsx_document bd ON bd.id = bi.document_id
            JOIN bsx_order bo ON bo.document_id = bd.id
            WHERE bd.document_type = 'ORDER'
              AND bi.item_type_id = 'P'
            GROUP BY bi.item_id, bi.color_id
        ),
        all_parts AS (
            SELECT part_num, color_id FROM inventory_items
            UNION
            SELECT part_num, color_id FROM sold_items
        )
        SELECT ap.part_num AS partNum,
               COALESCE(ii.item_name, si.item_name) AS partName,
               COALESCE(ii.color_name, si.color_name) AS colorName,
               ap.color_id AS colorId,
               COALESCE(ii.remaining_qty, 0) AS remainingQty,
               COALESCE(si.sold_qty, 0) AS soldQty,
               COALESCE(si.order_count, 0) AS orderCount
        FROM all_parts ap
        LEFT JOIN inventory_items ii ON ii.part_num = ap.part_num AND ii.color_id = ap.color_id
        LEFT JOIN sold_items si ON si.part_num = ap.part_num AND si.color_id = ap.color_id
        ORDER BY COALESCE(si.sold_qty, 0) DESC,
                 ap.part_num ASC,
                 ap.color_id ASC
        LIMIT :limit OFFSET :offset
        """, nativeQuery = true)
    List<InventoryRow> findInventoryPage(@Param("filename") String filename,
                                         @Param("limit") int limit,
                                         @Param("offset") int offset);

    @Query(value = """
        WITH inventory_items AS (
            SELECT bi.item_id AS part_num,
                   bi.color_id AS color_id
            FROM bsx_item bi
            JOIN bsx_document bd ON bd.id = bi.document_id
            WHERE bd.document_type = 'INVENTORY'
              AND bd.filename = :filename
              AND bi.item_type_id = 'P'
            GROUP BY bi.item_id, bi.color_id
        ),
        sold_items AS (
            SELECT bi.item_id AS part_num,
                   bi.color_id AS color_id
            FROM bsx_item bi
            JOIN bsx_document bd ON bd.id = bi.document_id
            JOIN bsx_order bo ON bo.document_id = bd.id
            WHERE bd.document_type = 'ORDER'
              AND bi.item_type_id = 'P'
            GROUP BY bi.item_id, bi.color_id
        ),
        all_parts AS (
            SELECT part_num, color_id FROM inventory_items
            UNION
            SELECT part_num, color_id FROM sold_items
        )
        SELECT COUNT(*) FROM all_parts
        """, nativeQuery = true)
    long countInventory(@Param("filename") String filename);

    interface InventoryRow {
        String getPartNum();
        String getPartName();
        String getColorName();
        Integer getColorId();
        Integer getRemainingQty();
        Integer getSoldQty();
        Integer getOrderCount();
    }
}
