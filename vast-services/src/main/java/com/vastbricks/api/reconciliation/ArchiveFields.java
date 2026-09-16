package com.vastbricks.api.reconciliation;

import lombok.Getter;
import lombok.Setter;

/**
 * What the store's own order archive holds for the order: the copies it took of what the marketplace showed, kept
 * against the day the marketplace no longer shows them.
 *
 * <p>A source of its own rather than part of the order's account, because it is nobody's claim about the order. The
 * marketplace, the payment provider and the accounting system each state what an order came to; this states only
 * whether the store still has the document, which is a different question and one no other source can answer.
 *
 * <p>A detail mapper fills it in for the orders the archive holds a document for, so a field stays {@code null} on
 * every other order. Whether a missing document is a failure is a rule's decision: BrickOwl issues no VAT invoice
 * and neither does a BrickLink order the marketplace collected no tax on, so most orders have none and should.
 */
@Getter
@Setter
public class ArchiveFields {

    /**
     * Whether the VAT invoice BrickLink issued for the order is in the store's archive, or {@code null} where the
     * archive holds none. It is only ever {@code TRUE}: the archive is asked which orders it has an invoice for, not
     * whether it has one for a given order, so an order it did not name is one it holds nothing for.
     */
    private Boolean vatInvoice;
}
