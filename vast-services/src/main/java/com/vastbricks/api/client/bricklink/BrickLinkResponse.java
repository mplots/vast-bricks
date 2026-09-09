package com.vastbricks.api.client.bricklink;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** BrickLink's envelope: everything it answers carries a meta beside the data. */
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
class BrickLinkResponse<T> {

    private Meta meta;

    private T data;

    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class Meta {

        private Integer code;

        private String message;

        private String description;
    }
}
