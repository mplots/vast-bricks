package com.vastbricks.accounting.paypal;

import com.paypal.sdk.models.SearchResponse;
import com.paypal.sdk.models.SearchTransactionsInput;

public interface PayPalTransactionGateway {
    SearchResponse searchTransactions(SearchTransactionsInput input);
}
