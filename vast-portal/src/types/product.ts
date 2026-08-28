export interface ProductOffer {
  productId: number;
  lowestOfferId: number;
  setName: string;
  setNumber: number;
  theme: string;
  webStore: string;
  price: number;
  lowestPrice: number;
  partOutPrice: number;
  partOutRatio: number;
  pricePeerPeace: number;
  image: string;
  purchaseLink: string;
  partOutLink: string;
  eanIds: string[];
  priceTimestamp: string;
  pieces: number | null;
  lots: number | null;
}

export interface ProductPrice {
  offerId: number;
  webStore: string;
  price: string;
  timestamp: string;
}

export interface ProductDetails {
  offer: ProductOffer;
  prices: ProductPrice[];
}

export type ProductQueryParams = {
  limit?: number;
  set?: number;
  ean?: number;
  atl?: boolean;
  stores?: string[];
  themes?: string[];
};
