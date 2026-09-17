package com.vastbricks.api.shippingprice;

/** The two things a store posts, as the tariff book names them. */
public enum ShipmentType {

    /**
     * Sikpaka: letter correspondence with objects in it, up to 2 kg.
     *
     * <p>Almost every order goes as one of these. Note that the provider reaches it as a {@code parcel} of size
     * {@code small}, not as a {@code letter} - its {@code letter} is the tariff book's Vestule, which is for
     * documents and is priced differently.
     */
    SMALL_PACKET,

    /** Paka: a parcel, which is what a shipment too heavy for a Sikpaka becomes. */
    PARCEL
}
