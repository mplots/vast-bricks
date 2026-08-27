package com.vastbricks.accounting.stripe;

import com.stripe.model.BalanceTransactionCollection;
import com.stripe.param.BalanceTransactionListParams;

public interface StripeTransactionGateway {
    BalanceTransactionCollection listBalanceTransactions(BalanceTransactionListParams params);
}
