package com.vastbricks.api.orderarchive;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Getter;

/** One order of the store, as much of it as the archive needs to ask after its VAT invoice and to file one. */
@Getter
@AllArgsConstructor
public class VatInvoiceOrder {

    private final String orderId;

    /** When the order was placed, which is what tells a collector how far back it is being sent. */
    private final Instant orderDate;

    /** The moment the order was last archived as, which is what the invoice is filed beside its other files under. */
    private final Instant archivedAt;
}
