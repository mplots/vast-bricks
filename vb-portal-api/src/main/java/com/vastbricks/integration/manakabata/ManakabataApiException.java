package com.vastbricks.integration.manakabata;

import org.apache.commons.lang3.StringUtils;
import org.springframework.web.client.RestClientResponseException;

public class ManakabataApiException extends RuntimeException {
    public ManakabataApiException(RestClientResponseException cause) {
        super(message(cause), cause);
    }

    private static String message(RestClientResponseException cause) {
        var responseBody = StringUtils.trimToNull(cause.getResponseBodyAsString());
        if (responseBody == null) {
            return "Manakabata returned HTTP " + cause.getStatusCode().value();
        }
        return "Manakabata returned HTTP " + cause.getStatusCode().value() + ": "
            + StringUtils.abbreviate(responseBody, 1000);
    }
}
