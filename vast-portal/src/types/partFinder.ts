/** A part in one color, with how many sets for sale contain it. */
export interface PartColor {
  partNum: string;
  partName: string;
  colorId: number;
  colorName: string;
  colorRgb: string | null;
  image: string | null;
  setCount: number;
}

export interface StoreOffer {
  webStore: string;
  price: number;
  link: string;
  seenAt: string;
}

/** A set for sale containing the part, with every store selling it, cheapest first. */
export interface SetForSale {
  setNumber: number;
  setName: string;
  theme: string | null;
  pieces: number | null;
  partQty: number;
  image: string | null;
  stores: StoreOffer[];
}
