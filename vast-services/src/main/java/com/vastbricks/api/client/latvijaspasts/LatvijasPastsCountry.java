package com.vastbricks.api.client.latvijaspasts;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

/** One destination the calculator prices, as it lists itself. */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class LatvijasPastsCountry {

    /**
     * The provider's own destination code.
     *
     * <p>Usually ISO-3166 alpha-2, but not always: a territory priced apart from its mainland - the Azores, Madeira -
     * carries a numeric code of the provider's own making. So this is a string that happens to look like a country
     * code rather than one, and nothing should join to it without knowing that.
     */
    private String code;

    /** The destination's English name. */
    private String name;

    /** Its Latvian name, which the provider states beside the English one. */
    private String nameLv;

    private boolean active;
}
