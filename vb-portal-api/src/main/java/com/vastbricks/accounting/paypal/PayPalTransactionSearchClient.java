package com.vastbricks.accounting.paypal;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.paypal.sdk.Environment;
import com.paypal.sdk.PaypalServerSdkClient;
import com.paypal.sdk.authentication.ClientCredentialsAuthModel;
import com.paypal.sdk.controllers.TransactionSearchController;
import com.paypal.sdk.exceptions.ApiException;
import com.paypal.sdk.http.response.ApiResponse;
import com.paypal.sdk.models.SearchResponse;
import com.paypal.sdk.models.SearchTransactionsInput;
import com.vastbricks.config.Env;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;

@Slf4j
public class PayPalTransactionSearchClient implements PayPalTransactionGateway {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final TransactionSearchController transactionSearchController;

    public PayPalTransactionSearchClient(Env env) {
        var clientId = requireConfigured("PAYPAL_CLIENT_ID", env.getPaypalClientId());
        var clientSecret = requireConfigured("PAYPAL_CLIENT_SECRET", env.getPaypalClientSecret());
        var environment = paypalEnvironment(env.getPaypalEnvironment());

        var client = new PaypalServerSdkClient.Builder()
                .clientCredentialsAuth(new ClientCredentialsAuthModel.Builder(clientId, clientSecret).build())
                .environment(environment)
                .build();
        this.transactionSearchController = client.getTransactionSearchController();
    }

    @Override
    public SearchResponse searchTransactions(SearchTransactionsInput input) {
        try {
            var response = transactionSearchController.searchTransactions(input);
            logRawResponse(input, response);
            return response.getResult();
        } catch (ApiException | IOException ex) {
            throw new PayPalTransactionException("Failed to search PayPal transactions", ex);
        }
    }

    private void logRawResponse(SearchTransactionsInput input, ApiResponse<SearchResponse> response) {
        if (!log.isInfoEnabled()) {
            return;
        }
        log.info(
                "PayPal transactions raw response for startDate={}, endDate={}, page={}: status={}, headers={}, body={}",
                input.getStartDate(),
                input.getEndDate(),
                input.getPage(),
                response.getStatusCode(),
                response.getHeaders(),
                rawBody(response.getResult())
        );
    }

    private String rawBody(SearchResponse response) {
        try {
            return OBJECT_MAPPER.writeValueAsString(response);
        } catch (JsonProcessingException ex) {
            return String.valueOf(response);
        }
    }

    private String requireConfigured(String name, String value) {
        if (value == null || value.isBlank()) {
            throw new PayPalTransactionException(name + " environment variable is required");
        }
        return value;
    }

    private Environment paypalEnvironment(String value) {
        if ("LIVE".equalsIgnoreCase(value) || "PRODUCTION".equalsIgnoreCase(value)) {
            return Environment.PRODUCTION;
        }
        return Environment.SANDBOX;
    }
}
