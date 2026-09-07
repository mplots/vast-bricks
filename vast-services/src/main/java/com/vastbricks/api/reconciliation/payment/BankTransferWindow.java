package com.vastbricks.api.reconciliation.payment;

import java.time.LocalDate;
import java.time.YearMonth;

/**
 * The span of booking days the bank entries are read for when a month is reconciled.
 *
 * <p>It is days rather than instants, unlike {@link PaymentWindow}: a bank dates an entry by the day it booked it,
 * not by a moment in a zone of its own, and the entries are read out of Vast's own store rather than asked of a
 * provider.
 *
 * <p>The pad is lopsided because a bank transfer is paid after the order rather than around it. A buyer pays when
 * they get around to it, sometimes weeks later, and a buyer who underpaid sends the rest later still, so the window
 * reaches three months past the month and barely before it — the few days before covering only the marketplaces
 * dating an order in their own zone.
 *
 * <p>A wide window is safe here in a way it would not be for a weaker key: a transfer is attached to an order only
 * by the order id it names, never by its date, so a transfer belonging to another month's order matches nothing and
 * is ignored. What the pad costs is a wider read of one indexed local table.
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

    static BankTransferWindow of(YearMonth month) {
        return new BankTransferWindow(
                month.atDay(1).minusDays(PAD_DAYS_BEFORE),
                month.atEndOfMonth().plusDays(PAD_DAYS_AFTER)
        );
    }

    /** The first day read, included. */
    LocalDate from() {
        return from;
    }

    /** The last day read, included. */
    LocalDate to() {
        return to;
    }
}
