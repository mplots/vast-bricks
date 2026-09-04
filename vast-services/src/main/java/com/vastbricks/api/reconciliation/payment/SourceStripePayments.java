package com.vastbricks.api.reconciliation.payment;

import com.stripe.model.BalanceTransaction;
import com.vastbricks.api.client.stripe.StripePaymentClient;
import com.vastbricks.api.reconciliation.Source;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Fetches the Stripe balance transactions of the month. Stripe dates transactions in UTC, so the month is asked for
 * as a UTC window; the client follows Stripe's paging, and nothing here filters or interprets what came back.
 *
 * <p>It declares Stripe's own model rather than a carrier, because it assembles nothing beyond the paging the client
 * already hides. A second source over balance transactions would have to introduce one, as exactly one source may
 * return a given class.
 */
@Component
@RequiredArgsConstructor
class SourceStripePayments implements Source<BalanceTransaction> {

    private final StripePaymentClient stripePaymentClient;

    @Override
    public Class<BalanceTransaction> type() {
        return BalanceTransaction.class;
    }

    @Override
    public List<BalanceTransaction> fetch(YearMonth month) {
        return stripePaymentClient.listBalanceTransactions(
                month.atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC),
                month.atEndOfMonth().atTime(23, 59, 59).toInstant(ZoneOffset.UTC)
        );
    }
}
