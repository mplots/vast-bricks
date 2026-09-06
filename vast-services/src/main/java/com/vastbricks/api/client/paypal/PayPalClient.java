package com.vastbricks.api.client.paypal;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.vastbricks.api.client.HttpExchangeCapture;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * PayPal transport. It reports the transactions of a period through PayPal's transaction search, following its page
 * numbering so its callers see one flat list, and decides nothing about what a transaction means.
 *
 * <p>Written on {@link RestClient} rather than on PayPal's own SDK because that SDK addresses its two hosts through a
 * {@code SANDBOX}/{@code PRODUCTION} enum and accepts no other base URL, which leaves it untestable against a mocked
 * provider. The sandbox is simply another base URL here.
 */
@Component
public class PayPalClient {

    private static final int PAGE_SIZE = 500;

    /** Pages requested at most, so a provider that keeps reporting more pages fails instead of looping forever. */
    private static final int MAX_PAGES = 100;

    /**
     * The longest range PayPal's transaction search accepts in one request. A longer period is asked for a segment at
     * a time rather than refused, because how long a request may reach is PayPal's protocol and not something its
     * callers should have to shape their period around.
     */
    private static final int MAX_RANGE_DAYS = 31;

    /**
     * How far short of now a searched range stops. PayPal refuses a range reaching into the future, and the clocks
     * deciding what the future is are not the same one, so a window padded up to now would fail on skew alone. A
     * payment taken inside the margin is collected by the next run, which is what a reconciled month asks for anyway.
     */
    private static final int NOW_MARGIN_MINUTES = 1;

    private static final String PROVIDER = "PayPal";
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper().registerModule(new JavaTimeModule());

    private final PayPalSettings settings;
    private final HttpExchangeCapture capture;
    private final RestClient restClient;

    PayPalClient(PayPalSettings settings, HttpExchangeCapture capture) {
        this.settings = settings;
        this.capture = capture;
        this.restClient = RestClient.builder()
                .requestFactory(new SimpleClientHttpRequestFactory())
                .messageConverters(converters -> converters.addFirst(
                        new MappingJackson2HttpMessageConverter(OBJECT_MAPPER)
                ))
                .requestInterceptor(HttpExchangeCapture.interceptor())
                .build();
    }

    /**
     * Every transaction PayPal reports for the period, both ends included. A period longer than PayPal searches in
     * one request is covered by several, so one recorded operation covers the client-credentials token request and
     * one search request per page of each segment PayPal reports.
     */
    public List<PayPalTransaction> listTransactions(Instant from, Instant to) {
        return capture.record(
                PROVIDER,
                List.of(
                        required("PayPal client id", settings.getClientId()),
                        required("PayPal client secret", settings.getClientSecret())
                ),
                () -> collectTransactions(from, to)
        );
    }

    private List<PayPalTransaction> collectTransactions(Instant from, Instant to) {
        // PayPal reports what it has taken, so a period reaching past now is searched up to now. A period lying
        // wholly ahead of it has nothing to report rather than nothing to ask, and is not asked for at all.
        var searchTo = earliest(to, Instant.now().minus(NOW_MARGIN_MINUTES, ChronoUnit.MINUTES));
        if (from.isAfter(searchTo)) {
            return List.of();
        }

        var accessToken = accessToken();
        var transactions = new ArrayList<PayPalTransaction>();

        var segmentFrom = from;
        while (!segmentFrom.isAfter(searchTo)) {
            var segmentTo = earliest(segmentFrom.plus(MAX_RANGE_DAYS, ChronoUnit.DAYS), searchTo);
            collectSegment(accessToken, segmentFrom, segmentTo, transactions);
            // The next segment starts after this one ended: PayPal reports both ends of a range, and a transaction
            // reported by two segments would be read as two payments.
            segmentFrom = segmentTo.plusSeconds(1);
        }
        return List.copyOf(transactions);
    }

    private void collectSegment(
            String accessToken,
            Instant from,
            Instant to,
            List<PayPalTransaction> transactions
    ) {
        for (var page = 1; page <= MAX_PAGES; page++) {
            var response = searchTransactions(accessToken, from, to, page);
            if (response == null || response.getTransactionDetails() == null) {
                return;
            }
            transactions.addAll(response.getTransactionDetails());
            if (response.getTotalPages() == null || page >= response.getTotalPages()) {
                return;
            }
        }
        throw new PayPalClientException(
                "PayPal reports more than the " + MAX_PAGES + " transaction pages a request can collect"
        );
    }

    private static Instant earliest(Instant one, Instant other) {
        return one.isBefore(other) ? one : other;
    }

    /**
     * A date as PayPal's transaction search reads one: to the second. It rejects a date carrying a fraction outright,
     * and the clock a window is closed at reports one, so the fraction is dropped here rather than left to callers.
     */
    private static String searchDate(Instant instant) {
        return DateTimeFormatter.ISO_INSTANT.format(instant.truncatedTo(ChronoUnit.SECONDS));
    }

    private PayPalTransactionsResponse searchTransactions(String accessToken, Instant from, Instant to, int page) {
        try {
            return restClient.get()
                    .uri(
                            url("/v1/reporting/transactions")
                                    + "?start_date={startDate}&end_date={endDate}&fields=all"
                                    + "&balance_affecting_records_only=Y&page_size={pageSize}&page={page}",
                            Map.of(
                                    "startDate", searchDate(from),
                                    "endDate", searchDate(to),
                                    "pageSize", PAGE_SIZE,
                                    "page", page
                            )
                    )
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .retrieve()
                    .body(PayPalTransactionsResponse.class);
        } catch (RestClientException exception) {
            throw new PayPalClientException("PayPal transaction search failed", exception);
        }
    }

    /**
     * A client-credentials access token, requested per call. PayPal issues these with a lifetime of hours, but a
     * cached one would outlive the settings it was requested with, and one token request per reconciled month is not
     * worth that.
     */
    private String accessToken() {
        var form = new LinkedMultiValueMap<String, String>();
        form.add("grant_type", "client_credentials");

        PayPalTokenResponse response;
        try {
            response = restClient.post()
                    .uri(url("/v1/oauth2/token"))
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .headers(headers -> headers.setBasicAuth(
                            required("PayPal client id", settings.getClientId()),
                            required("PayPal client secret", settings.getClientSecret())
                    ))
                    .body(form)
                    .retrieve()
                    .body(PayPalTokenResponse.class);
        } catch (RestClientException exception) {
            throw new PayPalClientException("PayPal authentication failed", exception);
        }

        if (response == null || response.getAccessToken() == null || response.getAccessToken().isBlank()) {
            throw new PayPalClientException("PayPal returned no access token");
        }
        // The token is a credential of its own, and the response that issued it has already been recorded.
        HttpExchangeCapture.mask(response.getAccessToken());
        return response.getAccessToken();
    }

    private String url(String path) {
        var baseUrl = required("PayPal base URL", settings.getBaseUrl());
        return baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) + path : baseUrl + path;
    }

    private String required(String name, String value) {
        if (value == null || value.isBlank()) {
            throw new PayPalClientException(name + " is not configured");
        }
        return value.trim();
    }
}
