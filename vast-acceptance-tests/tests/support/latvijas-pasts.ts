import type { APIRequestContext, TestInfo } from "@playwright/test";

import type { SettingsOverrides } from "./api-test";
import { WireMockApi } from "./wiremock";

/**
 * The Latvijas Pasts tariff calculator's own protocol, so a scenario states the tariff it is about and nothing of
 * how the provider hands it over.
 *
 * <p>Which is worth stating, because the provider hands it over strangely. Asked about a weight nothing can carry,
 * it answers not with an error but with every weight band of every service at once - and as a bare list of prices
 * with no weight against any of them, the insured variant mixed in among them. That shape is the whole reason the
 * sweep works in fifty requests rather than two thousand, and the whole reason it has to be tested.
 *
 * <p>The sweep also asks a second question, for a weight the provider can carry, and abandons the run if the single
 * price it gets back disagrees with the ladder. So both are stubbed here, and both are derived from the same stated
 * tariff - a scenario wanting them to disagree says so.
 */

/** The weight the sweep asks about, heavier than anything the post office carries. */
const OVER_MAXIMUM_GRAMS = 40_000;

/** The weight the sweep checks the ladder against. */
const PROBE_GRAMS = 500;

/** The tariff book's Sikpaka bands, by the heaviest gram each covers. */
export const SMALL_PACKET_BANDS = [20, 100, 500, 1000, 2000];

/**
 * One destination's tariff, as a scenario states it. Every price is in whole cents, VAT included, exactly as the
 * provider counts.
 */
export type LatvijasPastsTariff = {
  /** The provider's own destination code. A scenario uses one of its own so it shares no rows with another. */
  code: string;
  name: string;
  /** The five Sikpaka band prices, lightest first. */
  smallPacket: number[];
  /** What tracking adds on top of the Sikpaka base, which is what makes Economy into Standard. */
  tracking: number;
  /** The Paka band prices, one per kilogram, lightest first. */
  parcel: number[];
  /**
   * States the Paka ladder the way the provider states it for a handful of destinations: as an object keyed by
   * position rather than as an array, with no insured ladder beside it.
   *
   * <p>That is PHP's own encoding of an array whose keys stopped being consecutive, which is what the provider's
   * server leaves behind when it filters the insured prices out. It is not a hypothetical: twelve real destinations
   * arrive this way, and a client that reads only arrays reads none of them.
   */
  parcelAsKeyedObject?: boolean;
  /**
   * States the Paka ladder twice over, which is how the provider answers for St Helena: two ranges of ten
   * kilograms priced identically, under one label, from two runs of its own tariff. Read as one ladder they would
   * put every band after the first out by one, so the destination has to be refused instead.
   */
  parcelLadderRepeated?: boolean;
  /** How long the provider says it takes, in its own wording: `15 - 20`, `15-20` or a bare `16`. */
  deliveryDays?: string;
};

/**
 * A destination code no real one collides with, so a scenario writing the global tariff table is invisible to the
 * scenarios running beside it. The table is not tenant-owned - a published tariff belongs to no store - so this is
 * what isolates a scenario instead.
 */
export function aDestinationCode(testInfo: TestInfo, suffix = ""): string {
  const unique = `${testInfo.workerIndex}${testInfo.parallelIndex}${Date.now()}${Math.random()}`
    .replace(/\D/g, "")
    .slice(-7);
  return `T${suffix}${unique}`.slice(0, 10).toUpperCase();
}

/** Points the sweep at WireMock and stubs the destination list and the prices of every stated tariff. */
export async function mockLatvijasPasts(
  settings: SettingsOverrides,
  request: APIRequestContext,
  testInfo: TestInfo,
  tariffs: LatvijasPastsTariff[],
) {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();
  await settings.set("VAST_LATVIJASPASTS_BASE_URL", wireMock.baseUrl);
  // The sweep paces itself between requests, which a scenario has no reason to wait through.
  await settings.set("VAST_LATVIJASPASTS_REQUEST_DELAY_MS", "0");

  await stubCountries(wireMock, tariffs);
  // One stub per weight, answering for every destination at once. The sweep asks about five countries per request,
  // and the provider answers all five in one response - so a stub per destination would have them competing to
  // answer the same request, and whichever won would leave the others looking unpriced.
  await stubLadder(wireMock, tariffs);
  await stubProbe(wireMock, tariffs);
  return wireMock;
}

/** The destination list, in the Hydra collection form the provider's API Platform serves everything as. */
async function stubCountries(wireMock: WireMockApi, tariffs: LatvijasPastsTariff[]) {
  await wireMock.addMethodHostMapping("GET", "/api/public/countries", {
    response: {
      // As the provider labels it. It is an API Platform application and answers in JSON-LD, never plain JSON, and a
      // stub that said application/json would let a client that cannot read JSON-LD pass here and fail for real.
      headers: { "Content-Type": "application/ld+json;charset=utf-8" },
      json: {
        "hydra:member": tariffs.map((tariff) => ({
          "@id": `/api/countries/${tariff.code}`,
          code: tariff.code,
          name: tariff.name,
          nameLv: tariff.name,
          active: true,
        })),
      },
    },
  });
}

/**
 * The answer to the sweep's own question: every band of every service, unordered, with the insured ladder mixed in.
 *
 * <p>Stated in the provider's own disorder on purpose. A stub that answered in weight order would let a sweep that
 * read the bands by arrival pass, and reading them by arrival is exactly the mistake there is to make here.
 */
async function stubLadder(wireMock: WireMockApi, tariffs: LatvijasPastsTariff[]) {
  await wireMock.addMethodHostMapping("POST", "/api/public/prices/by_country", {
    priority: 1,
    request: {
      bodyPatterns: [{ contains: `"weight":${OVER_MAXIMUM_GRAMS}` }],
    },
    response: {
      headers: { "Content-Type": "application/ld+json;charset=utf-8" },
      json: {
        workFlows: tariffs.flatMap((tariff) => [
          workFlow(tariff, "parcel-standard-small", "small", shuffled(tariff.smallPacket), {
            maxWeightInKg: 2,
            tracking: tariff.tracking,
          }),
          workFlow(tariff, "parcel-economy-small", "small", shuffled(tariff.smallPacket), { maxWeightInKg: 2 }),
          workFlow(tariff, "parcel-standardPlus-large", "large", shuffled(
            tariff.parcelLadderRepeated ? [...tariff.parcel, ...tariff.parcel] : tariff.parcel,
          ), {
            maxWeightInKg: tariff.parcel.length,
            // The insured ladder arrives in the same list as the one it insures, priced higher throughout - except
            // where the provider has already filtered it out, which is the case that leaves an object behind.
            insured: tariff.parcelAsKeyedObject ? undefined : tariff.parcel.map((price) => price + 282),
            keyed: tariff.parcelAsKeyedObject,
          }),
          // Everything the sweep is supposed to ignore: a courier, a parcel machine, the premium service.
          workFlow(tariff, "parcel-premium-large", "large", shuffled(tariff.parcel.map((price) => price * 2)), {
            maxWeightInKg: tariff.parcel.length,
          }),
          workFlow(tariff, "courier-courier", "XL", [1540], {}),
          workFlow(tariff, "parcelMachine-parcelMachine", "M", [292], {}),
        ]),
      },
    },
  });
}

/** The answer to the sweep's check: what one real weight costs, which is a single price and not a ladder. */
async function stubProbe(wireMock: WireMockApi, tariffs: LatvijasPastsTariff[]) {
  await wireMock.addMethodHostMapping("POST", "/api/public/prices/by_country", {
    priority: 1,
    request: {
      bodyPatterns: [{ contains: `"weight":${PROBE_GRAMS}` }],
    },
    response: {
      headers: { "Content-Type": "application/ld+json;charset=utf-8" },
      json: {
        workFlows: tariffs.flatMap((tariff) => [
          workFlow(tariff, "parcel-economy-small", "small", [priceAt(tariff, PROBE_GRAMS)], {}),
          workFlow(tariff, "parcel-standard-small", "small", [priceAt(tariff, PROBE_GRAMS)], {
            tracking: tariff.tracking,
          }),
          workFlow(tariff, "parcel-standardPlus-large", "large", [tariff.parcel[0]], {}),
        ]),
      },
    },
  });
}

/** The Sikpaka price a stated weight falls into, which is what a quote for that weight answers. */
function priceAt(tariff: LatvijasPastsTariff, grams: number): number {
  const band = SMALL_PACKET_BANDS.findIndex((ceiling) => grams <= ceiling);
  return tariff.smallPacket[band < 0 ? tariff.smallPacket.length - 1 : band];
}

function workFlow(
  tariff: LatvijasPastsTariff,
  label: string,
  shipmentSizeType: string,
  prices: number[],
  options: { maxWeightInKg?: number; tracking?: number; insured?: number[]; keyed?: boolean },
) {
  const entries = [
    ...prices.map((priceWithTax) => ({ priceWithTax, insurance: false })),
    ...(options.insured ?? []).map((priceWithTax) => ({ priceWithTax, insurance: true })),
  ];

  // Keyed from where the filtered-out entries left off, exactly as the provider's own encoder numbers them.
  const weightCosts = options.keyed
    ? Object.fromEntries(entries.map((entry, index) => [String(index + entries.length), entry]))
    : entries;

  return {
    "@type": "WorkFlow",
    label,
    countryCode: tariff.code,
    shipmentSizeType,
    ...(options.maxWeightInKg === undefined ? {} : { maxWeightInKg: options.maxWeightInKg }),
    weightCosts,
    additionalServiceCosts: [
      { name: "courierPickUp", priceWithTax: 688 },
      ...(options.tracking === undefined ? [] : [{ name: "trackingInternational", priceWithTax: options.tracking }]),
    ],
    deliveryDays: tariff.deliveryDays ?? "4 - 5",
  };
}

/** The same prices in an order no reader would put them in, which is how the provider states them. */
function shuffled(prices: number[]): number[] {
  const out = [...prices];
  // Deterministic, so a failing scenario fails the same way twice: the middle first, then out to the edges.
  out.reverse();
  const middle = out.splice(Math.floor(out.length / 2), 1);
  return [...middle, ...out];
}

/** One stored band, as the shipping prices endpoint states it. */
export type ShippingPriceRow = {
  shipmentType: "SMALL_PACKET" | "PARCEL";
  service: "ECONOMY" | "STANDARD" | "STANDARD_PLUS";
  weightFromGrams: number;
  weightToGrams: number;
  basePrice: number;
  trackingFee: number;
  totalPrice: number;
  currency: string;
  deliveryDaysMin: number | null;
  deliveryDaysMax: number | null;
  validFrom: string;
};

export type ShippingPricesPage = {
  code: string;
  name: string;
  checkedAt: string | null;
  prices: ShippingPriceRow[];
};
