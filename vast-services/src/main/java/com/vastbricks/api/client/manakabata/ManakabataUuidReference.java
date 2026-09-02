package com.vastbricks.api.client.manakabata;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * Reference to an existing Manakabata entity. The published specification types these references as arrays of strings
 * although the API expects a lookup object, so they are declared here rather than taken from the generated models.
 */
@Data
@AllArgsConstructor
public class ManakabataUuidReference {
    private String uuid;
}
