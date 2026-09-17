package com.vastbricks.api.order;

import java.time.Instant;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Getter;

/** Every response body of the VAT invoice collection endpoints. Public because its controller is reached from
 * outside this application, by the browser extension that does the collecting. */
public final class VatInvoicePayload {

    private VatInvoicePayload() {
    }

    @Getter
    @AllArgsConstructor
    public static final class OutstandingResponse {
        private List<OutstandingOrder> orders;
    }

    /** One order the store owes a VAT invoice for, as the collector is told about it. */
    @Getter
    @AllArgsConstructor
    public static final class OutstandingOrder {
        private String orderId;
        /** When the order was placed, which is what tells a collector how far back it is being sent. */
        private Instant orderDate;
    }

    @Getter
    @AllArgsConstructor
    public static final class StoredVatInvoice {
        private String orderId;
        /** False where the archive already held this order's invoice, which is not a failure and not a rewrite. */
        private boolean stored;
    }
}
