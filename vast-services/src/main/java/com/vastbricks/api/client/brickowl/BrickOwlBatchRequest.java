package com.vastbricks.api.client.brickowl;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BrickOwlBatchRequest {
    private String endpoint;

    @JsonProperty("request_method")
    private String requestMethod;

    private List<Map<String, String>> params;

    public static BrickOwlBatchRequest get(String endpoint, Map<String, String> params) {
        return new BrickOwlBatchRequest(endpoint, "GET", List.of(params));
    }

    public static BrickOwlBatchRequest post(String endpoint, Map<String, String> params) {
        return new BrickOwlBatchRequest(endpoint, "POST", List.of(params));
    }
}
