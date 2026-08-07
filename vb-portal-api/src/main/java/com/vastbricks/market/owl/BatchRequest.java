package com.vastbricks.market.owl;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BatchRequest {
    private String endpoint;

    @JsonProperty("request_method")
    private String requestMethod;

    private List<Map<String, String>> params;

    public static BatchRequest get(String endpoint, Map<String, String> params) {
        return new BatchRequest(endpoint, "GET", List.of(params));
    }

    public static BatchRequest post(String endpoint, Map<String, String> params) {
        return new BatchRequest(endpoint, "POST", List.of(params));
    }
}
