package com.vastbricks.market.owl;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;

@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Getter
public enum ItemType {
    PART("Part"),
    SET("Set"),
    MINIFIGURE("Minifigure"),
    GEAR("Gear"),
    STICKER("Sticker"),
    MINIBUILD("Minibuild"),
    INSTRUCTIONS("Instructions"),
    PACKAGING("Packaging");

    private String name;
}
