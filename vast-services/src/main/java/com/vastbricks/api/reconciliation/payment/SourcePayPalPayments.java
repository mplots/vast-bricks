package com.vastbricks.api.reconciliation.payment;

import com.vastbricks.api.client.paypal.PayPalClient;
import com.vastbricks.api.client.paypal.PayPalTransaction;
import com.vastbricks.api.reconciliation.Source;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Fetches the PayPal transactions of the month. PayPal's transaction search takes an instant range, so the month is
 * asked for as a UTC window, the same one Stripe's payments are asked for; the client follows PayPal's page
 * numbering, and nothing here filters or interprets what came back.
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
    public List<PayPalTransaction> fetch(YearMonth month) {
        return payPalClient.listTransactions(
                month.atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC),
                month.atEndOfMonth().atTime(23, 59, 59).toInstant(ZoneOffset.UTC)
        );
    }
}
