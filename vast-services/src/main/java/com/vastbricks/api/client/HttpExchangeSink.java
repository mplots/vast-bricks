package com.vastbricks.api.client;

import java.util.List;

/**
 * Where recorded HTTP traffic goes. The client layer records what crossed the wire and knows nothing about who wants
 * it; the debug feature implements this and decides whether anything is kept at all.
 */
public interface HttpExchangeSink {

    /**
     * One client operation's round trips, in the order they were made, with the client's secrets already masked.
     * Called once the operation is finished, whether it succeeded or not.
     */
    void record(String provider, List<RawHttpCall> calls);
}
