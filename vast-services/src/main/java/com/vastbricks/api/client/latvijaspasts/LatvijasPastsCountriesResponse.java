package com.vastbricks.api.client.latvijaspasts;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import lombok.Data;

/** The destination list, in the Hydra collection form the provider's API Platform serves everything as. */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class LatvijasPastsCountriesResponse {

    @JsonProperty("hydra:member")
    private List<LatvijasPastsCountry> members;
}
