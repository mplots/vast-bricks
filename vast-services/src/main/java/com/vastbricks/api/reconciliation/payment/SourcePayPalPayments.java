package com.vastbricks.api.reconciliation.payment;

import com.vastbricks.api.client.paypal.PayPalClient;
import com.vastbricks.api.client.paypal.PayPalTransaction;
import com.vastbricks.api.reconciliation.Source;
import com.vastbricks.api.reconciliation.ReconciliationPeriod;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Fetches the PayPal transactions around the selected order dates. PayPal's transaction search takes an instant range, so it is asked
 * for {@link PaymentWindow}, the same window Stripe's payments are asked for; the client follows PayPal's page
 * numbering and its limit on how long a searched range may be, and nothing here filters or interprets what came
 * back.
 */
@Component
@RequiredArgsConstructor
class SourcePayPalPayments implements Source<PayPalTransaction> {

    private final PayPalClient payPalClient;

    @Override
    public Class<PayPalTransaction> type() {
        return PayPalTransaction.class;
    }

    @Override
    public List<PayPalTransaction> fetch(ReconciliationPeriod period) {
        var window = PaymentWindow.of(period);
        return payPalClient.listTransactions(window.from(), window.to());
    }
}
