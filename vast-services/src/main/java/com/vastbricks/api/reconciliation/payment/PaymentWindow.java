package com.vastbricks.api.reconciliation.payment;

import java.time.Instant;
import com.vastbricks.api.reconciliation.ReconciliationPeriod;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

/**
 * The period the payment providers are asked for when a date range is reconciled. Both providers date their transactions
 * in UTC, so the selected dates form a UTC window; it starts before the selected dates and ends no earlier than today.
 *
 * <p>Stripe dates a balance transaction at the capture of the charge, which a marketplace may take days after the
 * buyer authorized it, so an order placed on the last of the month is commonly paid on the first of the next. The
 * marketplaces, for their part, date an order in a zone of their own, which moves an order across midnight either
 * way. An exact month therefore leaves such an order looking unpaid in its own month while its payment is fetched in
 * a month that holds no order to attach it to. The window starts seven days early for that, which is the longest
 * Stripe leaves an authorization capturable.
 *
 * <p>It ends today rather than seven days past the selected dates because a refund is dated when it was given, which
 * can be months after the order it returns. A window closing with the selected month would report such an order as
 * fully paid however long ago it was refunded, and would go on doing so for as long as anyone reads that month. A
 * period that has not ended yet is still read to its own padded end, so the window never stops short of what was
 * asked for.
 *
 * <p>Reaching to today costs nothing but the fetching: a payment is matched to an order by what it names — an order
 * number, a buyer — never by its date, so a transaction belonging to another month's order simply matches nothing
 * and is ignored. The same window is asked of PayPal so both providers answer for one period.
 */
final class PaymentWindow {

    private static final int PAD_DAYS = 7;

    private final Instant from;
    private final Instant to;

    private PaymentWindow(Instant from, Instant to) {
        this.from = from;
        this.to = to;
    }

    static PaymentWindow of(ReconciliationPeriod period) {
        var paddedTo = period.getTo().atTime(23, 59, 59).toInstant(ZoneOffset.UTC).plus(PAD_DAYS, ChronoUnit.DAYS);
        var endOfToday = LocalDate.now(ZoneOffset.UTC).atTime(23, 59, 59).toInstant(ZoneOffset.UTC);
        return new PaymentWindow(
                period.getFrom().atStartOfDay().toInstant(ZoneOffset.UTC).minus(PAD_DAYS, ChronoUnit.DAYS),
                paddedTo.isAfter(endOfToday) ? paddedTo : endOfToday
        );
    }

    /** The first instant asked for, included. */
    Instant from() {
        return from;
    }

    /** The last instant asked for, included. Never earlier than the end of today. */
    Instant to() {
        return to;
    }
}
