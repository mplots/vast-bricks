package com.vastbricks.api.client.bricklink;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Signs a request the way BrickLink's store API asks for: one-legged OAuth 1.0a, HMAC-SHA1, in the
 * {@code Authorization} header.
 *
 * <p>Written here rather than taken from a library because the only one the legacy client used is built on Apache
 * HttpClient 4, which {@code vast-services} does not otherwise carry — signing one GET is less code than the
 * dependency.
 */
final class BrickLinkOAuth {

    private static final SecureRandom NONCES = new SecureRandom();
    private static final String SIGNATURE_METHOD = "HMAC-SHA1";
    private static final String HMAC_SHA1 = "HmacSHA1";

    private BrickLinkOAuth() {
    }

    /** The {@code Authorization} header value for this request, signed with these credentials. */
    static String authorization(String method, URI uri, BrickLinkSettings settings) {
        Map<String, String> oauth = new LinkedHashMap<>();
        oauth.put("oauth_consumer_key", settings.getConsumerKey().trim());
        oauth.put("oauth_token", settings.getTokenValue().trim());
        oauth.put("oauth_signature_method", SIGNATURE_METHOD);
        oauth.put("oauth_timestamp", String.valueOf(System.currentTimeMillis() / 1000));
        oauth.put("oauth_nonce", nonce());
        oauth.put("oauth_version", "1.0");

        oauth.put("oauth_signature", sign(method, uri, oauth, settings));

        StringBuilder header = new StringBuilder("OAuth ");
        oauth.forEach((name, value) -> header
                .append(header.length() > "OAuth ".length() ? ", " : "")
                .append(encode(name))
                .append("=\"")
                .append(encode(value))
                .append('"'));
        return header.toString();
    }

    private static String sign(String method, URI uri, Map<String, String> oauth, BrickLinkSettings settings) {
        // Every parameter of the request signs it, the query's as much as OAuth's own, sorted by name.
        Map<String, String> parameters = new TreeMap<>(oauth);
        parameters.remove("oauth_signature");
        queryParameters(uri, parameters);

        StringBuilder normalized = new StringBuilder();
        parameters.forEach((name, value) -> normalized
                .append(normalized.isEmpty() ? "" : "&")
                .append(encode(name))
                .append('=')
                .append(encode(value)));

        String base = method.toUpperCase(Locale.ROOT)
                + '&' + encode(baseUri(uri))
                + '&' + encode(normalized.toString());
        String key = encode(settings.getConsumerSecret().trim()) + '&' + encode(settings.getTokenSecret().trim());

        try {
            Mac mac = Mac.getInstance(HMAC_SHA1);
            mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), HMAC_SHA1));
            return Base64.getEncoder().encodeToString(mac.doFinal(base.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new BrickLinkClientException("Could not sign the BrickLink request", exception);
        }
    }

    private static void queryParameters(URI uri, Map<String, String> parameters) {
        String query = uri.getRawQuery();
        if (query == null || query.isBlank()) {
            return;
        }
        for (String pair : query.split("&")) {
            int equals = pair.indexOf('=');
            String name = equals < 0 ? pair : pair.substring(0, equals);
            String value = equals < 0 ? "" : pair.substring(equals + 1);
            parameters.put(decode(name), decode(value));
        }
    }

    /** The signed URI is the address without its query and without a default port. */
    private static String baseUri(URI uri) {
        StringBuilder base = new StringBuilder()
                .append(uri.getScheme().toLowerCase(Locale.ROOT))
                .append("://")
                .append(uri.getHost().toLowerCase(Locale.ROOT));
        int port = uri.getPort();
        boolean defaultPort = port == -1
                || (port == 80 && "http".equalsIgnoreCase(uri.getScheme()))
                || (port == 443 && "https".equalsIgnoreCase(uri.getScheme()));
        if (!defaultPort) {
            base.append(':').append(port);
        }
        return base.append(uri.getRawPath() == null ? "" : uri.getRawPath()).toString();
    }

    private static String nonce() {
        byte[] bytes = new byte[16];
        NONCES.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    /** Percent encoding as OAuth defines it, which is stricter than a URL encoder's. */
    private static String encode(String value) {
        StringBuilder encoded = new StringBuilder();
        for (byte raw : value.getBytes(StandardCharsets.UTF_8)) {
            char character = (char) (raw & 0xFF);
            if ((character >= 'A' && character <= 'Z')
                    || (character >= 'a' && character <= 'z')
                    || (character >= '0' && character <= '9')
                    || character == '-' || character == '.' || character == '_' || character == '~') {
                encoded.append(character);
            } else {
                encoded.append('%').append(String.format("%02X", raw & 0xFF));
            }
        }
        return encoded.toString();
    }

    private static String decode(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }
}
