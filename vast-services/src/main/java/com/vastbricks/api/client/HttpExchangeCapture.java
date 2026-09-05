package com.vastbricks.api.client;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Records the raw HTTP traffic of one client operation and hands it to the {@link HttpExchangeSink}.
 *
 * <p>A client installs {@link #interceptor()} on its {@link RestClient} once and wraps the operation it wants recorded
 * in {@link #record}. Outside a recorded operation the interceptor does nothing at all, so a client's normal calls
 * keep the behavior and cost they had before it was installed.
 *
 * <p>The scope is thread-local and lives for one operation, which is also the thread it runs on. A client that fans
 * requests out to other threads inside one operation records on each of them separately.
 */
@Component
@RequiredArgsConstructor
public class HttpExchangeCapture {

    private static final String MASK = "***";
    private static final ThreadLocal<Scope> ACTIVE = new ThreadLocal<>();

    private final HttpExchangeSink sink;

    /**
     * Records every request this client makes during a recorded operation, and passes the response on unchanged. The
     * response body is read here, so it is handed to the caller as a fresh stream over the same bytes; reading it
     * without doing that would leave the caller nothing to deserialize.
     */
    public static ClientHttpRequestInterceptor interceptor() {
        return (request, body, execution) -> {
            var scope = ACTIVE.get();
            if (scope == null) {
                return execution.execute(request, body);
            }

            var startedAt = System.nanoTime();
            var response = execution.execute(request, body);
            var responseBody = response.getBody().readAllBytes();
            scope.add(new RawHttpCall(
                    request.getMethod().name(),
                    request.getURI().toString(),
                    text(body, request.getHeaders()),
                    response.getStatusCode().value(),
                    text(responseBody, response.getHeaders()),
                    millisSince(startedAt)
            ));
            return new CapturedResponse(response, responseBody);
        };
    }

    /**
     * Runs {@code call} and reports every request it made to the sink. The secrets are the values this client knows
     * it sent; each is masked wherever it appears in the recorded URLs and bodies, so a recorded exchange never
     * carries a credential.
     *
     * <p>Masking happens once the operation is done rather than as each request is recorded, so a credential the call
     * only learns along the way — a session token a provider issues mid-operation — is masked in the response that
     * issued it as well as in the requests that go on to use it. A failed operation reports what it managed to send
     * before it failed, which is usually the interesting part.
     */
    public <T> T record(String provider, Collection<String> secrets, Supplier<T> call) {
        var scope = new Scope(secrets);
        ACTIVE.set(scope);
        try {
            return call.get();
        } finally {
            ACTIVE.remove();
            if (!scope.calls.isEmpty()) {
                sink.record(provider, scope.masked());
            }
        }
    }

    /**
     * Records one round trip a client made outside {@link #interceptor()}. A provider reached through its own SDK has
     * no Spring interceptor to hang the capture on, so its transport reports what it sent and received here instead.
     * Does nothing outside a recorded operation, so a client may call it unconditionally.
     */
    public static void add(RawHttpCall call) {
        var scope = ACTIVE.get();
        if (scope != null) {
            scope.add(call);
        }
    }

    /**
     * Masks one more value in the operation this thread is inside, for a credential the client did not have when it
     * started. Does nothing outside a recorded operation, so a client may call it unconditionally.
     */
    public static void mask(String secret) {
        var scope = ACTIVE.get();
        if (scope != null) {
            scope.addSecret(secret);
        }
    }

    public static long millisSince(long startedAtNanos) {
        return (System.nanoTime() - startedAtNanos) / 1_000_000;
    }

    private static String text(byte[] body, HttpHeaders headers) {
        if (body == null || body.length == 0) {
            return null;
        }
        return new String(body, charset(headers));
    }

    private static Charset charset(HttpHeaders headers) {
        var contentType = headers.getContentType();
        var charset = contentType == null ? null : contentType.getCharset();
        return charset == null ? StandardCharsets.UTF_8 : charset;
    }

    /** One operation in progress: what it has sent so far, and what must never appear in it. */
    private static final class Scope {

        private final List<RawHttpCall> calls = new ArrayList<>();
        private final List<String> secrets = new ArrayList<>();

        private Scope(Collection<String> secrets) {
            secrets.forEach(this::addSecret);
        }

        private void addSecret(String secret) {
            if (secret == null || secret.isBlank()) {
                return;
            }
            secrets.add(secret);
            // A secret travels through a query string and through a form body, so it is also masked as encoded.
            var encoded = URLEncoder.encode(secret, StandardCharsets.UTF_8);
            if (!encoded.equals(secret)) {
                secrets.add(encoded);
            }
        }

        private void add(RawHttpCall call) {
            calls.add(call);
        }

        /** Every recorded call with every secret this operation came to know masked out of it. */
        private List<RawHttpCall> masked() {
            return calls.stream()
                    .map(call -> new RawHttpCall(
                            call.getMethod(),
                            mask(call.getUrl()),
                            mask(call.getRequestBody()),
                            call.getStatusCode(),
                            mask(call.getResponseBody()),
                            call.getDurationMillis()
                    ))
                    .toList();
        }

        private String mask(String text) {
            if (text == null) {
                return null;
            }
            var masked = text;
            for (var secret : secrets) {
                masked = masked.replace(secret, MASK);
            }
            return masked;
        }
    }

    /** The provider's response with its body already read, served back to the caller over the same bytes. */
    private static final class CapturedResponse implements ClientHttpResponse {

        private final ClientHttpResponse response;
        private final byte[] body;

        private CapturedResponse(ClientHttpResponse response, byte[] body) {
            this.response = response;
            this.body = body;
        }

        @Override
        public HttpStatusCode getStatusCode() throws IOException {
            return response.getStatusCode();
        }

        @Override
        public String getStatusText() throws IOException {
            return response.getStatusText();
        }

        @Override
        public HttpHeaders getHeaders() {
            return response.getHeaders();
        }

        @Override
        public InputStream getBody() {
            return new ByteArrayInputStream(body);
        }

        @Override
        public void close() {
            response.close();
        }
    }
}
