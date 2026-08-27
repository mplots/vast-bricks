package com.vastbricks.accounting.stripe;

import com.stripe.exception.StripeException;
import com.stripe.model.BalanceTransaction;
import com.stripe.model.BalanceTransactionCollection;
import com.stripe.net.RequestOptions;
import com.stripe.param.BalanceTransactionListParams;
import com.vastbricks.config.Env;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class StripeBalanceTransactionClient implements StripeTransactionGateway {
    private final RequestOptions requestOptions;

    public StripeBalanceTransactionClient(Env env) {
        this.requestOptions = RequestOptions.builder()
                .setApiKey(requireConfigured("STRIPE_SECRET_KEY", env.getStripeSecretKey()))
                .build();
    }

    @Override
    public BalanceTransactionCollection listBalanceTransactions(BalanceTransactionListParams params) {
        try {
            var response = BalanceTransaction.list(params, requestOptions);
            logRawResponse(response);
            return response;
        } catch (StripeException ex) {
            throw new StripeTransactionException("Failed to list Stripe balance transactions", ex);
        }
    }

    private void logRawResponse(BalanceTransactionCollection response) {
        if (!log.isInfoEnabled()) {
            return;
        }
        log.info(
                "Stripe balance transactions raw response: hasMore={}, url={}, body={}",
                response.getHasMore(),
                response.getUrl(),
                rawBody(response)
        );
    }

    private String rawBody(BalanceTransactionCollection response) {
        return response.getRawJsonObject() == null
                ? String.valueOf(response)
                : response.getRawJsonObject().toString();
    }

    private String requireConfigured(String name, String value) {
        if (value == null || value.isBlank()) {
            throw new StripeTransactionException(name + " environment variable is required");
        }
        return value;
    }
}
