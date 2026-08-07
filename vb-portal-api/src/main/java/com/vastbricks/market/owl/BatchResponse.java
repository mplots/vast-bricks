package com.vastbricks.market.owl;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class BatchResponse {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @JsonProperty("req_num")
    private Integer requestNumber;

    private Integer code;

    private JsonNode body;

    public <T> T bodyAs(Class<T> responseType) {
        return MAPPER.convertValue(body, responseType);
    }

    public <T> T bodyAs(TypeReference<T> responseType) {
        return MAPPER.convertValue(body, responseType);
    }
}
