package com.vastbricks.api.client.brickowl;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class BrickOwlBatchResponse {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper()
            .findAndRegisterModules()
            .configure(MapperFeature.ACCEPT_CASE_INSENSITIVE_ENUMS, true);

    @JsonProperty("req_num")
    private Integer requestNumber;

    private Integer code;
    private JsonNode body;

    public <T> T bodyAs(Class<T> responseType) {
        return OBJECT_MAPPER.convertValue(body, responseType);
    }

    public <T> T bodyAs(TypeReference<T> responseType) {
        return OBJECT_MAPPER.convertValue(body, responseType);
    }
}
