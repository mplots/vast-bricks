package com.vastbricks.api.shippingprice;

/** How a shipment is sent, among the services worth storing. */
public enum ShippingService {

    /** Economy, vienkarss: unregistered and untracked, delivered into the letterbox. */
    ECONOMY,

    /** Standard, izsekojams: registered and tracked at every stage. Its price is the economy base plus tracking. */
    STANDARD,

    /**
     * Standard+, ierakstits: signed for on handover.
     *
     * <p>The only service under {@link ShipmentType#PARCEL}, because it is the only one Latvijas Pasts sells for a
     * parcel - the tariff book's Pakas columns carry no economy or standard row at all.
     */
    STANDARD_PLUS
}
