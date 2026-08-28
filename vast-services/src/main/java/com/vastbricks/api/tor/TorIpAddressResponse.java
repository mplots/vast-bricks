package com.vastbricks.api.tor;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
class TorIpAddressResponse {

    @JsonProperty("IP")
    private String ipAddress;
}
