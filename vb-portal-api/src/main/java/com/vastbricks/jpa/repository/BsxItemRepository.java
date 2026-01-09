package com.vastbricks.jpa.repository;

import com.vastbricks.jpa.entity.bsx.BsxItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface BsxItemRepository extends JpaRepository<BsxItem, Long> {
    @Query(value = """
        SELECT 
            bo.order_date AS orderDate,
            bi.item_id AS itemId,
            bi.item_type_id AS itemTypeId,
            bi.color_id AS colorId,
            bi.qty AS qty
        FROM bsx_item bi
        JOIN bsx_order bo ON bo.document_id = bi.document_id
        WHERE bi.item_type_id IS NOT NULL
        """, nativeQuery = true)
    List<OrderItemRow> findOrderItems();

    interface OrderItemRow {
        Long getOrderDate();
        String getItemId();
        String getItemTypeId();
        Integer getColorId();
        Integer getQty();
    }

    java.util.List<BsxItem> findByDocumentId(Long documentId);
}
