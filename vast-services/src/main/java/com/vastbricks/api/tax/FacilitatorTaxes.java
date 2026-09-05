package com.vastbricks.api.tax;

import static com.vastbricks.api.tax.OrderTaxType.EXPORT_TAXABLE;

import com.vastbricks.api.client.brickowl.BrickOwlOrder;
import com.vastbricks.api.client.brickstore.BrickStoreOrder;
import java.math.BigDecimal;

/**
 * Derives what a marketplace collected on an order as tax facilitator: the tax it charged the buyer under its own
 * registration rather than the store's. Only an {@link OrderTaxType#EXPORT_TAXABLE} order carries one, so the type
 * decides whether there is an amount at all and the marketplace's own fields say how much.
 *
 * <p>An order of any other type has no facilitator tax rather than a zero: nothing was collected under a
 * facilitator's registration, which is a different fact from a facilitator collecting nothing.
 */
public final class FacilitatorTaxes {

    private FacilitatorTaxes() {
    }

    /** BrickOwl states the tax it charged as one amount. */
    public static BigDecimal of(BrickOwlOrder order) {
        return isFacilitated(OrderTaxTypes.of(order)) ? order.getTaxAmount() : null;
    }

    /**
     * BrickLink splits what it collected as facilitator between {@code ORDERSALESTAX} and {@code ORDERVAT} — one per
     * jurisdiction it charges under — and an order carries whichever applies, so the facilitator tax is their sum.
     */
    public static BigDecimal of(BrickStoreOrder order) {
        if (!isFacilitated(OrderTaxTypes.of(order))) {
            return null;
        }
        return zeroIfAbsent(order.getSalesTax()).add(zeroIfAbsent(order.getVat()));
    }

    private static boolean isFacilitated(OrderTaxType taxType) {
        return taxType == EXPORT_TAXABLE;
    }

    /** A charge the marketplace did not report is a charge of nothing, as it is when the type is derived. */
    private static BigDecimal zeroIfAbsent(BigDecimal amount) {
        return amount == null ? BigDecimal.ZERO : amount;
    }
}
