/** The two things a store posts, as the Latvijas Pasts tariff book names them. */
export type ShipmentType = 'SMALL_PACKET' | 'PARCEL';

/** How a shipment is sent. `STANDARD_PLUS` is the only service a parcel is sold under. */
export type ShippingService = 'ECONOMY' | 'STANDARD' | 'STANDARD_PLUS';

/** One destination there are prices for. Its code is the provider's own and is not always ISO-3166 alpha-2. */
export interface ShippingPriceCountry {
  code: string;
  name: string;
}

/** One weight band at one service. The base and the tracking are stated apart because the provider states them apart. */
export interface ShippingPrice {
  shipmentType: ShipmentType;
  service: ShippingService;
  weightFromGrams: number;
  weightToGrams: number;
  basePrice: number;
  trackingFee: number;
  totalPrice: number;
  currency: string;
  /** The fewest days the provider says this takes, or null where it states no estimate. */
  deliveryDaysMin: number | null;
  /** The most days it says the same service takes; equal to the minimum where it states one number. */
  deliveryDaysMax: number | null;
  validFrom: string;
}

export interface ShippingPricesPage {
  code: string;
  name: string;
  /** When the provider last confirmed these prices, or null where there are none. */
  checkedAt: string | null;
  prices: ShippingPrice[];
}
