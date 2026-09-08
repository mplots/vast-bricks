package com.vastbricks.api.client;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * One HTTP round trip exactly as it went over the wire. Bodies are what the two sides exchanged rather than anything
 * deserialized from them, so a caller can show what was really sent and received — and, where a side was not text at
 * all, hand the file over instead of showing it. See {@link RawHttpBody}.
 *
 * <p>The credentials the client declared are already masked in {@link #url} and in the bodies' text. Headers are
 * deliberately not captured: they carry mostly authentication, and nothing needs them yet.
 */
@Getter
@AllArgsConstructor
public class RawHttpCall {

    private final String method;

    /** The request URL, with the client's secrets masked. */
    private final String url;

    private final RawHttpBody requestBody;

    private final int statusCode;

    private final RawHttpBody responseBody;

    /** How long the round trip took, which is what tells a slow provider from a slow rule. */
    private final long durationMillis;
}
