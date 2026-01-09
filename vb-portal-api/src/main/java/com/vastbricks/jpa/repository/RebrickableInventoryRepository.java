package com.vastbricks.jpa.repository;

import com.vastbricks.jpa.entity.rebrickable.RebrickableInventory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface RebrickableInventoryRepository extends JpaRepository<RebrickableInventory, Integer> {

    @Query(value = """
        WITH latest_inventory AS (
            SELECT DISTINCT ON (set_num) id, set_num
            FROM rebrickable.inventories
            WHERE set_num IN (:setNums)
            ORDER BY set_num, version DESC
        )
        SELECT li.set_num AS setNum,
               ip.part_num AS partNum,
               m.bricklink_color_id AS bricklinkColorId,
               c.name AS colorName,
               p.name AS partName,
               ip.quantity AS quantity
        FROM rebrickable.inventory_parts ip
        JOIN latest_inventory li ON li.id = ip.inventory_id
        JOIN rebrickable.parts p ON p.part_num = ip.part_num
        JOIN rebrickable.colors c ON c.id = ip.color_id
        JOIN rebrickable_color_map m ON m.rebrickable_color_id = ip.color_id
        WHERE ip.is_spare = false
        """, nativeQuery = true)
    List<PartRow> findLatestInventoryParts(@Param("setNums") Collection<String> setNums);

    interface PartRow {
        String getSetNum();
        String getPartNum();
        Integer getBricklinkColorId();
        String getColorName();
        String getPartName();
        Integer getQuantity();
    }
}
