package com.vastbricks.api.reconciliation.payment;

import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

/**
 * The period the payment providers are asked for when a month is reconciled. Both providers date their transactions
 * in UTC, so the month is a UTC window; it is padded at both ends because a payment is not dated where its order is.
 *
 * <p>Stripe dates a balance transaction at the capture of the charge, which a marketplace may take days after the
 * buyer authorized it, so an order placed on the last of the month is commonly paid on the first of the next. The
 * marketplaces, for their part, date an order in a zone of their own, which moves an order across midnight either
 * way. An exact month therefore leaves such an order looking unpaid in its own month while its payment is fetched in
 * a month that holds no order to attach it to.
 *
 * <p>The pad costs nothing but the fetching: a payment is matched to an order by what it names — an order number, a
 * buyer — never by its date, so a transaction belonging to another month's order simply matches nothing and is
 * ignored. It is seven days because that is the longest Stripe leaves an authorization capturable, and the same
 * window is asked of PayPal so both providers answer for one period.
 */
final class PaymentWindow {

    private static final int PAD_DAYS = 7;

    private final Instant from;
    private final Instant to;

    private PaymentWindow(Instant from, Instant to) {
        this.from = from;
        this.to = to;
    }

    static PaymentWindow of(YearMonth month) {
        return new PaymentWindow(
                month.atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC).minus(PAD_DAYS, ChronoUnit.DAYS),
                month.atEndOfMonth().atTime(23, 59, 59).toInstant(ZoneOffset.UTC).plus(PAD_DAYS, ChronoUnit.DAYS)
        );
    }

    /** The first instant asked for, included. */
    Instant from() {
        return from;
    }

    /** The last instant asked for, included. */
    Instant to() {
        return to;
    }
}
