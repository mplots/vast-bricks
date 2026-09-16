package com.vastbricks.api.reconciliation.storesync;

import lombok.AllArgsConstructor;
import lombok.Getter;

/** One order BrickSync holds its own record of, named the way the reconciled orders are. */
@Getter
@AllArgsConstructor
class SourcedBrickSyncOrder {

    private final String marketplace;

    private final String orderId;
}
