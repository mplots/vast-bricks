package com.vastbricks.jpa.entity;


import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;

@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Getter
public enum WebStore {
    IIZII("iizii"),
    _1A("1a"),
    RD_ELECTRONIC("RD Electronic"),
    DIGIMART("Digimart"),
    MAXTRADE("Maxtrade"),
    BABY_CITY("Baby City"),
    LABS_VEIKALS("Labs Veikals"),
    M79("m79"),
    BARBORA("barbora"),
    XS("XS Rotaļlietas"),
    DEPO("Depo"),
    KSENUKAI("Ksenukai"),
    _220("220"),
    RIMI("RIMI"),
    OREOL("Oreol"),
    TOYS_PLANET("Toys Planet"),
    DATEKS("Dateks"),
    PIGU("Pigu"),
    BERNIEM("Berniem"),
    BALTIC_GURU("Baltic Guru")
    ;

    private final String name;
}
