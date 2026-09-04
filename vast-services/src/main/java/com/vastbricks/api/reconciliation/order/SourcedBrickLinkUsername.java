package com.vastbricks.api.reconciliation.order;

import lombok.AllArgsConstructor;
import lombok.Getter;

/** The username of one BrickLink order's buyer, as the export asked for without real names reports it. */
@Getter
@AllArgsConstructor
class SourcedBrickLinkUsername {

    private final String orderId;
    private final String buyerUsername;
}
