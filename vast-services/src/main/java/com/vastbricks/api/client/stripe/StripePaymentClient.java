package com.vastbricks.api.client.stripe;

import com.stripe.StripeClient;
import com.stripe.exception.StripeException;
import com.stripe.model.BalanceTransaction;
import com.stripe.model.StripeCollection;
import com.stripe.param.BalanceTransactionListParams;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Stripe transport. It reports the balance transactions of a period, following Stripe's own cursor paging so its
 * callers see one flat list, and decides nothing about what a transaction means.
 *
 * <p>Named for the feature it serves rather than for the provider, because {@link StripeClient} is the SDK's own
 * client and this class builds one.
 */
@Component
@RequiredArgsConstructor
public class StripePaymentClient {

    private static final long PAGE_SIZE = 100L;

    /**
     * Pages requested at most, so a provider that keeps reporting more transactions fails the request instead of
     * looping forever. At the page size above it covers far more transactions than a month can hold.
     */
    private static final int MAX_PAGES = 100;

    private final StripeSettings settings;

    /** Every balance transaction created in the period, both ends included. */
    public List<BalanceTransaction> listBalanceTransactions(Instant createdFrom, Instant createdTo) {
        var stripeClient = stripeClient();
        var transactions = new ArrayList<BalanceTransaction>();
        String startingAfter = null;

        for (var page = 0; page < MAX_PAGES; page++) {
            var response = list(stripeClient, createdFrom, createdTo, startingAfter);
            var data = response.getData();
            if (data == null || data.isEmpty()) {
                return List.copyOf(transactions);
            }
            transactions.addAll(data);
            if (!Boolean.TRUE.equals(response.getHasMore())) {
                return List.copyOf(transactions);
            }
            startingAfter = data.getLast().getId();
        }
        throw new StripeClientException(
                "Stripe reports more than the " + MAX_PAGES * PAGE_SIZE + " balance transactions a request can collect"
        );
    }

    private StripeCollection<BalanceTransaction> list(
            StripeClient stripeClient,
            Instant createdFrom,
            Instant createdTo,
            String startingAfter
    ) {
        try {
            return stripeClient.balanceTransactions().list(params(createdFrom, createdTo, startingAfter));
        } catch (StripeException exception) {
            throw new StripeClientException("Stripe balance transaction request failed", exception);
        }
    }

    private BalanceTransactionListParams params(Instant createdFrom, Instant createdTo, String startingAfter) {
        var params = BalanceTransactionListParams.builder()
                .setLimit(PAGE_SIZE)
                .setCreated(BalanceTransactionListParams.Created.builder()
                        .setGte(createdFrom.getEpochSecond())
                        .setLte(createdTo.getEpochSecond())
                        .build());
        // Transaction types are not filtered here: what a transaction means is a reconciliation decision.
        if (startingAfter != null) {
            params.setStartingAfter(startingAfter);
        }
        return params.build();
    }

    /**
     * The SDK client, built per call rather than held: the key and the base URL come from settings a request may
     * override, so a client cached across requests would answer with another request's configuration.
     */
    private StripeClient stripeClient() {
        return StripeClient.builder()
                .setApiKey(secretKey())
                .setApiBase(baseUrl())
                .build();
    }

    private String baseUrl() {
        var baseUrl = settings.getBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new StripeClientException("Stripe base URL is not configured");
        }
        baseUrl = baseUrl.trim();
        // The SDK appends the versioned path, so a trailing slash would request "//v1/...".
        return baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    private String secretKey() {
        var secretKey = settings.getSecretKey();
        if (secretKey == null || secretKey.isBlank()) {
            throw new StripeClientException("Stripe secret key is not configured");
        }
        return secretKey.trim();
    }
}
