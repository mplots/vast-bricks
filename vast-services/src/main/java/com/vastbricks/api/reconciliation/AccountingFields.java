package com.vastbricks.api.reconciliation;

import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;

/**
 * What the accounting system holds for the order: the invoice that was actually written for it. An accounting mapper
 * fills it in once it has decided which order an invoice belongs to, so every field is {@code null} until then and
 * stays {@code null} on an order no invoice was matched to — which is itself the fact that the order has not been
 * invoiced.
 *
 * <p>Its fields carry the same names as fields of {@link OrderFields}, for the same reason the gateway's do: an
 * invoice states a sub-total and a grand total of its own, and holding those against the marketplace's is comparing
 * two accounts of one order rather than two unrelated amounts. The VAT is the one thing only this source states.
 */
@Getter
@Setter
public class AccountingFields {

    /** What the invoice was written for before VAT, or {@code null} when no invoice was matched to the order. */
    private BigDecimal subTotal;

    /** The VAT the invoice charges on that sub-total, or {@code null} when no invoice was matched to the order. */
    private BigDecimal vat;

    /** What the invoice comes to with VAT, which is what the buyer is billed. */
    private BigDecimal grandTotal;
}
