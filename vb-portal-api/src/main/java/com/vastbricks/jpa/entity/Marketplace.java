package com.vastbricks.jpa.entity;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum Marketplace {
    BRICK_LINK,
    BRICK_OWL;

    @JsonCreator
    public static Marketplace from(String value) {
        if (value == null) {
            return null;
        }
        var upper = value.trim().toUpperCase();
        if (upper.equals("BRICKLINK") || upper.equals("BRICK_LINK")) {
            return BRICK_LINK;
        }
        if (upper.equals("BRICKOWL") || upper.equals("BRICK_OWL")) {
            return BRICK_OWL;
        }
        throw new IllegalArgumentException("source must be bricklink or brickowl");
    }
}
