package com.vastbricks.api.client.brickowl;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * One order, twice: as BrickOwl sent it and as this client reads it.
 *
 * <p>Both, for the same reason {@code BrickLinkOrderDocument} states both: a caller archiving an order stores exactly
 * what the provider sent while deciding what to store from what it says, and reading the batch body a second time in
 * the caller would put BrickOwl's wire format in a feature that has no other reason to know it.
 */
@Getter
@AllArgsConstructor
public class BrickOwlOrderDocument {

    private final String json;

    private final BrickOwlOrder order;
}
