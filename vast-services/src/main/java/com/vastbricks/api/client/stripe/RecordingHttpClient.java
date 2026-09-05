package com.vastbricks.api.client.stripe;

import com.stripe.exception.StripeException;
import com.stripe.net.HttpClient;
import com.stripe.net.StripeRequest;
import com.stripe.net.StripeResponse;
import com.vastbricks.api.client.HttpExchangeCapture;
import com.vastbricks.api.client.RawHttpCall;

/**
 * The Stripe SDK's transport, reporting what it sent and received to the raw exchange capture.
 *
 * <p>Stripe is reached through its own SDK rather than a Spring {@code RestClient}, so there is no request
 * interceptor to hang the capture on. Decorating the SDK's own HTTP client is the equivalent seam: every call the SDK
 * makes passes through {@link #request}, including the ones it retries and the ones that answer an error, and each is
 * recorded as it went over the wire. Outside a capture the recording is a no-op and this is a plain delegate.
 */
class RecordingHttpClient extends HttpClient {

    private final HttpClient delegate;

    RecordingHttpClient(HttpClient delegate) {
        this.delegate = delegate;
    }

    @Override
    public StripeResponse request(StripeRequest request) throws StripeException {
        var startedAt = System.nanoTime();
        var response = delegate.request(request);
        HttpExchangeCapture.add(new RawHttpCall(
                request.method().name(),
                request.url().toString(),
                requestBody(request),
                response.code(),
                response.body(),
                HttpExchangeCapture.millisSince(startedAt)
        ));
        return response;
    }

    /** What the request carried, or {@code null} for the ones that carry nothing, as a listing does. */
    private String requestBody(StripeRequest request) {
        var content = request.content();
        return content == null ? null : content.stringContent();
    }
}
