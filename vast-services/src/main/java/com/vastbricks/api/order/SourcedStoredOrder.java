package com.vastbricks.api.order;

import com.vastbricks.api.orderarchive.OrderSource;
import lombok.AllArgsConstructor;
import lombok.Getter;

/** One stored order, as the reconciliation sourcing stage hands it to the mapper that merges it. */
@Getter
@AllArgsConstructor
class SourcedStoredOrder {

    private final OrderSource source;

    private final String orderId;

    private final Order order;
}
