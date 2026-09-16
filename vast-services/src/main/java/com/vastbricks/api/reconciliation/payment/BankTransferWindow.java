package com.vastbricks.api.reconciliation.payment;

import java.time.LocalDate;
import com.vastbricks.api.reconciliation.ReconciliationPeriod;

/**
 * The span of booking days the bank entries are read for when a date range is reconciled.
 *
 * <p>It is days rather than instants, unlike {@link PaymentWindow}: a bank dates an entry by the day it booked it,
 * not by a moment in a zone of its own, and the entries are read out of Vast's own store rather than asked of a
 * provider.
 *
 * <p>The window is lopsided because a bank transfer is settled after the order rather than around it. It reaches
 * barely before the selected dates — the few days before covering only the marketplaces dating an order in their own
 * zone — and it ends today, because a buyer pays when they get around to it, a buyer who underpaid sends the rest
 * later still, and a refund is repaid whenever it was agreed, sometimes months after the order. A window closing
 * with the selected month would report such an order as settled however long ago the money went back. A period that
 * has not ended yet is still read ninety days past its own end, so the window never stops short of what was asked
 * for.
 *
 * <p>A wide window is safe here in a way it would not be for a weaker key: a transfer is attached to an order only
 * by the order id it names, never by its date, so a transfer belonging to another month's order matches nothing and
 * is ignored. What the width costs is a wider read of one indexed local table.
 */
final class BankTransferWindow {

    private static final int PAD_DAYS_BEFORE = 7;
    private static final int PAD_DAYS_AFTER = 90;

    private final LocalDate from;
    private final LocalDate to;

    private BankTransferWindow(LocalDate from, LocalDate to) {
        this.from = from;
        this.to = to;
    }

    static BankTransferWindow of(ReconciliationPeriod period) {
        var paddedTo = period.getTo().plusDays(PAD_DAYS_AFTER);
        var today = LocalDate.now();
        return new BankTransferWindow(
                period.getFrom().minusDays(PAD_DAYS_BEFORE),
                paddedTo.isAfter(today) ? paddedTo : today
        );
    }

    /** The first day read, included. */
    LocalDate from() {
        return from;
    }

    /** The last day read, included. Never earlier than today. */
    LocalDate to() {
        return to;
    }
}
