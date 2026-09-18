package com.vastbricks.api.order;

import com.vastbricks.api.orderarchive.OrderSource;
import com.vastbricks.api.tax.OrderTaxType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.TenantId;

/**
 * One marketplace order, as the archive last held it.
 *
 * <p>Tenant-owned: {@code @TenantId} is the whole of making it so. Hibernate stamps the serving tenant on insert and
 * appends it to the SQL of every query it generates for this entity, including a load by primary key, so no
 * repository method names the tenant and none can forget to.
 */
@Entity
@Table(name = "orders", schema = "vast")
@Getter
@Setter
@NoArgsConstructor
class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, updatable = false)
    private OrderSource source;

    /** The marketplace's own order id, which together with the source is what a re-import finds the order by. */
    @Column(name = "order_id", nullable = false, length = 50, updatable = false)
    private String orderId;

    @Column(name = "order_date", nullable = false)
    private Instant orderDate;

    /** The distinct items ordered, whatever quantity each was ordered in. */
    @Column(name = "lot_count")
    private Integer lotCount;

    /** Every item ordered, counted one by one. */
    @Column(name = "item_count")
    private Integer itemCount;

    /** The buyer's own name, which BrickLink states only in its accounting export. */
    @Column
    private String buyer;

    /** The buyer's account with the marketplace, which BrickLink states only in its API record. */
    @Column(name = "buyer_username")
    private String buyerUsername;

    /** The country the order was shipped to, as a two-letter code, or null where nothing archived states an address. */
    @Column(length = 2)
    private String country;

    /** How the order was paid, unified across the marketplaces' wordings. */
    @Column(name = "payment_method", length = 100)
    private String paymentMethod;

    /** How the order is treated for tax, or null where nothing archived states enough to type it. */
    @Enumerated(EnumType.STRING)
    @Column(name = "tax_type", length = 30)
    private OrderTaxType taxType;

    /** What the marketplace collected on the order as tax facilitator, or null where it collected none. */
    @Column(name = "facilitator_tax", precision = 19, scale = 2)
    private BigDecimal facilitatorTax;

    @Column(name = "sub_total", precision = 19, scale = 2)
    private BigDecimal subTotal;

    /** What the buyer was charged for shipping, which is their side of the postage rather than the post office's. */
    @Column(name = "shipping_cost", precision = 19, scale = 2)
    private BigDecimal shippingCost;

    /** What the marketplace reports was refunded, or null where it reports none. */
    @Column(name = "refunded_amount", precision = 19, scale = 2)
    private BigDecimal refundedAmount;

    /** What the order came to, in whatever the buyer paid in, which {@link #currency} names. */
    @Column(name = "grand_total", precision = 19, scale = 2)
    private BigDecimal grandTotal;

    @Column(length = 3)
    private String currency;

    /**
     * The moment the imported file was the archive of. What makes the import an upsert: a file naming a later moment
     * replaces this row, and one naming this moment or an earlier one leaves it alone.
     */
    @Column(name = "archived_at", nullable = false)
    private Instant archivedAt;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    Order(OrderSource source, String orderId) {
        this.source = source;
        this.orderId = orderId;
        this.updatedAt = Instant.now();
    }

    @PreUpdate
    void markUpdated() {
        updatedAt = Instant.now();
    }
}
