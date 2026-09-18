package com.vastbricks.api.invoice;

import static com.vastbricks.api.charges.OrderTaxType.DOMESTIC;
import static com.vastbricks.api.charges.OrderTaxType.EUROPEAN_UNION;
import static com.vastbricks.api.charges.OrderTaxType.EXPORT;
import static com.vastbricks.api.charges.OrderTaxType.EXPORT_TAXABLE;

import com.vastbricks.api.charges.OrderTaxType;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * The VAT one invoice is issued under, which is decided by the order's tax type and by nothing else: a sale within
 * Latvia or into another member state is charged at the Latvian rate, and an export carries none — whether or not the
 * marketplace taxed it under its own registration, since that tax is not the store's to invoice.
 *
 * <p>An order with no tax type is not invoiced at all: how the sale is treated for tax is what decides the rate, so
 * there is no rate to fall back on.
 */
@Getter
@RequiredArgsConstructor(access = AccessLevel.PRIVATE)
final class InvoiceVat {

    private static final BigDecimal LATVIAN_RATE = BigDecimal.valueOf(21);
    private static final BigDecimal NO_RATE = BigDecimal.ZERO;

    private static final Map<OrderTaxType, BigDecimal> RATES = Map.of(
            DOMESTIC, LATVIAN_RATE,
            EUROPEAN_UNION, LATVIAN_RATE,
            EXPORT, NO_RATE,
            EXPORT_TAXABLE, NO_RATE
    );

    private static final int AMOUNT_SCALE = 2;
    private static final BigDecimal PERCENT = BigDecimal.valueOf(100);

    /** VAT percent, as Manakabata reads a line's tax. */
    private final BigDecimal rate;

    static InvoiceVat of(OrderTaxType taxType) {
        var rate = taxType == null ? null : RATES.get(taxType);
        if (rate == null) {
            throw new InvoiceException("Order has no tax type to invoice under");
        }
        return new InvoiceVat(rate);
    }

    /**
     * The amount to invoice, without VAT. A marketplace states its totals with the tax it charged included, while
     * Manakabata reads a line price as the price before VAT and adds the rate back on top, so the rate is taken out
     * once here and the invoice comes to the amount the order actually did.
     */
    BigDecimal netOf(BigDecimal grossAmount) {
        return grossAmount.divide(
                BigDecimal.ONE.add(rate.divide(PERCENT, 4, RoundingMode.HALF_UP)),
                AMOUNT_SCALE,
                RoundingMode.HALF_UP
        );
    }
}
