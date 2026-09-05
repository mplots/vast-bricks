package com.vastbricks.api.tax;

import static com.vastbricks.api.tax.OrderTaxType.DOMESTIC;
import static com.vastbricks.api.tax.OrderTaxType.EUROPEAN_UNION;
import static com.vastbricks.api.tax.OrderTaxType.EXPORT;
import static com.vastbricks.api.tax.OrderTaxType.EXPORT_TAXABLE;

import com.vastbricks.api.client.brickowl.BrickOwlOrder;
import com.vastbricks.api.client.brickstore.BrickStoreOrder;
import java.math.BigDecimal;
import java.util.Locale;

/**
 * Derives an order's {@link OrderTaxType} from what its marketplace reported. Each marketplace states the same fact
 * with its own fields, so there is one method per marketplace order and one shared vocabulary out.
 *
 * <p>The checks are ordered, first match winning, because the conditions overlap: a Latvian order and an order the
 * marketplace taxed outside the EU both carry a tax scheme, and an untaxed export is an EU order whose rate happens
 * to be zero. Ordering them is what tells the four types apart. An order stating none of it is left with no type
 * rather than guessed at.
 */
public final class OrderTaxTypes {

    private static final String DOMESTIC_COUNTRY_CODE = "LV";
    private static final String DOMESTIC_LOCATION = "latvia";

    private OrderTaxTypes() {
    }

    /** BrickOwl states the tax scheme it charged under, the rate, and the country it billed. */
    public static OrderTaxType of(BrickOwlOrder order) {
        if (order == null) {
            return null;
        }
        var taxed = order.getTaxSchemeId() != null && !order.getTaxSchemeId().isBlank();
        var rate = order.getTaxRate();
        if (taxed && rate != null) {
            return DOMESTIC_COUNTRY_CODE.equalsIgnoreCase(order.getBillingCountryCode()) ? DOMESTIC : EXPORT_TAXABLE;
        }
        if (taxed || rate == null) {
            return null;
        }
        return isZero(rate) ? EXPORT : EUROPEAN_UNION;
    }

    /**
     * BrickLink names no tax scheme, so what it charged stands in for one: {@code VATCHARGES} is the VAT it collected
     * under the store's own registration, and an export it taxed all the same carries the marketplace's own
     * {@code ORDERSALESTAX} or {@code ORDERVAT} instead. Both are exported as {@code 0.00} rather than omitted, so it
     * is a charge of zero, not a missing field, that says no tax was taken.
     */
    public static OrderTaxType of(BrickStoreOrder order) {
        if (order == null || order.getVatCharges() == null) {
            return null;
        }
        if (!isZero(order.getVatCharges())) {
            return isDomesticLocation(order.getLocation()) ? DOMESTIC : EUROPEAN_UNION;
        }
        return isZero(order.getSalesTax()) && isZero(order.getVat()) ? EXPORT : EXPORT_TAXABLE;
    }

    /** The export names the buyer's country first, as {@code Latvia, Riga}. */
    private static boolean isDomesticLocation(String location) {
        return location != null && location.toLowerCase(Locale.ROOT).contains(DOMESTIC_LOCATION);
    }

    /** A charge no marketplace reported is a charge of nothing. */
    private static boolean isZero(BigDecimal amount) {
        return amount == null || amount.signum() == 0;
    }
}
