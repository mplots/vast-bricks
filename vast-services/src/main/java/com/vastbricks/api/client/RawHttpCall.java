package com.vastbricks.api.client;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * One HTTP round trip exactly as it went over the wire, in plain text. Bodies are the JSON or XML the two sides
 * exchanged rather than anything deserialized from them, so a caller can show what was really sent and received.
 *
 * <p>The credentials the client declared are already masked in {@link #url} and {@link #requestBody}. Headers are
 * deliberately not captured: they carry mostly authentication, and nothing needs them yet.
 */
@Getter
@AllArgsConstructor
public class RawHttpCall {

    private final String method;

    /** The request URL, with the client's secrets masked. */
    private final String url;

    /** The request body as text, or {@code null} when the request carried none. */
    private final String requestBody;

    private final int statusCode;

    /** The response body as text, or {@code null} when the response carried none. */
    private final String responseBody;

    /** How long the round trip took, which is what tells a slow provider from a slow rule. */
    private final long durationMillis;
}
