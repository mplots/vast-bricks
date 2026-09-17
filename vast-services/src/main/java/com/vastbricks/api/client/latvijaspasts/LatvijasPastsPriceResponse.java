package com.vastbricks.api.client.latvijaspasts;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import java.util.Map;
import lombok.Data;

/** What the calculator answers one price request with. */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class LatvijasPastsPriceResponse {

    /** Every way of sending, for every country asked about, flattened into one list. */
    private List<LatvijasPastsWorkFlow> workFlows;

    /**
     * The destinations it would not price, by code.
     *
     * <p>A destination it has nothing to say about is reported here rather than left out, and the request still
     * succeeds - which is what lets one call ask about five countries when one of them is not served.
     */
    private Map<String, String> errors;
}
