package com.vastbricks.jpa.repository;

import com.vastbricks.jpa.entity.ProductPurchase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public interface ProductPurchaseRepository extends JpaRepository<ProductPurchase, Long> {

    @Query(value = """
        SELECT 
            pp.id AS id,
            pp.set_number AS setNumber,
            bs.name AS setName,
            pp.web_store AS webStore,
            pp.price AS price,
            pp.quantity AS quantity,
            pp.purchased_at AS purchasedAt,
            TO_CHAR(pp.purchased_at, 'DD-MM-YYYY') AS purchasedAtDisplay,
            t.total_amount AS totalAmount,
            (
                SELECT p.image 
                FROM product p 
                WHERE p.brick_set_number = pp.set_number 
                  AND p.web_store = pp.web_store 
                ORDER BY p.id 
                LIMIT 1
            ) AS image
        FROM product_purchase pp
        JOIN brick_set bs ON bs.number = pp.set_number
        CROSS JOIN LATERAL (SELECT pp.price * pp.quantity AS total_amount) t
        ORDER BY pp.purchased_at DESC, pp.id DESC
        """, nativeQuery = true)
    List<PurchaseRow> findAllWithSetOrdered();

    interface PurchaseRow {
        Long getId();
        Long getSetNumber();
        String getSetName();
        String getWebStore();
        BigDecimal getPrice();
        Integer getQuantity();
        LocalDate getPurchasedAt();
        String getPurchasedAtDisplay();
        String getImage();
        BigDecimal getTotalAmount();
    }

    @Query(value = "SELECT DISTINCT set_number FROM product_purchase", nativeQuery = true)
    List<Long> findDistinctSetNumbers();
}
