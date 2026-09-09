package com.vastbricks.api.client.bricklink;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * One order, twice: as BrickLink sent it and as this client reads it.
 *
 * <p>Both, because a caller archiving an order stores exactly what the provider sent while deciding what to store
 * from what it says. Parsing the raw JSON a second time in the caller would put BrickLink's wire format in a feature
 * that has no other reason to know it.
 */
@Getter
@AllArgsConstructor
public class BrickLinkOrderDocument {

    private final String json;

    private final BrickLinkOrder order;
}
