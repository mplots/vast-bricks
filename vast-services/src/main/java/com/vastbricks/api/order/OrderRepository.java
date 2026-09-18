package com.vastbricks.api.order;

import com.vastbricks.api.orderarchive.OrderSource;
import com.vastbricks.api.charges.OrderTaxType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.context.annotation.DependsOn;
import org.springframework.data.jpa.repository.JpaRepository;

@DependsOn("vastDatabaseMigration")
interface OrderRepository extends JpaRepository<Order, Long> {

    // No tenant in any signature on purpose: Hibernate adds it from the entity's @TenantId. A tenant named here
    // would be a second, forgettable answer to a question already answered.

    /** The order an import is about to write again, if this store already holds one under that id. */
    Optional<Order> findBySourceAndOrderId(OrderSource source, String orderId);

    List<Order> findAllByOrderByOrderDateDescIdDesc();

    /** The store's orders of one marketplace treated one way for tax, newest first. */
    List<Order> findBySourceAndTaxTypeOrderByOrderDateDescIdDesc(OrderSource source, OrderTaxType taxType);

    /** The orders placed in a range, newest first. The tenant is Hibernate's to add, as everywhere else here. */
    List<Order> findByOrderDateGreaterThanEqualAndOrderDateLessThanOrderByOrderDateDescIdDesc(Instant from, Instant to);
}
