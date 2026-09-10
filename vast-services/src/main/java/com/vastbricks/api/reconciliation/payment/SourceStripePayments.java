package com.vastbricks.api.reconciliation.payment;

import com.stripe.model.BalanceTransaction;
import com.vastbricks.api.client.stripe.StripeBalanceClient;
import com.vastbricks.api.reconciliation.Source;
import com.vastbricks.api.reconciliation.ReconciliationPeriod;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Fetches the Stripe balance transactions around the selected order dates. The window asked for is {@link PaymentWindow}, which reaches
 * past the selected dates at both ends because Stripe dates a transaction at the capture of its charge rather than at the
 * order; the client follows Stripe's paging, and nothing here filters or interprets what came back.
 *
 * <p>It declares Stripe's own model rather than a carrier, because it assembles nothing beyond the paging the client
 * already hides. A second source over balance transactions would have to introduce one, as exactly one source may
 * return a given class.
 */
@Component
@RequiredArgsConstructor
class SourceStripePayments implements Source<BalanceTransaction> {

    private final StripeBalanceClient stripeBalanceClient;

    @Override
    public Class<BalanceTransaction> type() {
        return BalanceTransaction.class;
    }

    @Override
    public List<BalanceTransaction> fetch(ReconciliationPeriod period) {
        var window = PaymentWindow.of(period);
        return stripeBalanceClient.listBalanceTransactions(window.from(), window.to());
    }
}
