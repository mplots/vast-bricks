import type { APIRequestContext } from "@playwright/test";

import { expect, test } from "../support/api-test";
import {
  aDestinationCode,
  mockLatvijasPasts,
  type LatvijasPastsTariff,
  type ShippingPriceRow,
  type ShippingPricesPage,
} from "../support/latvijas-pasts";

/**
 * The shipping price sweep and the table it fills.
 *
 * <p>What these are about is the one hard thing the feature does: the provider states a whole country's tariff as an
 * unordered list of prices with no weight against any of them, and the sweep has to turn that back into weight
 * bands. So the stub states them in disorder, and these assert the bands come out right anyway.
 *
 * <p>The table is global rather than tenant-owned - a published tariff is the same price for every store - so a
 * scenario cannot rely on its tenant to keep it apart from the scenarios beside it. Each states a destination code
 * of its own instead, and the sweep touches no destination it was not told about.
 */

const job = "shipping-price-sync";

/** Germany's real shape, obfuscated only in that the destination is one no post office serves. */
function aTariff(code: string): LatvijasPastsTariff {
  return {
    code,
    name: `Test destination ${code}`,
    // 5.03, 5.08, 6.12, 8.16, 9.55 - the five Sikpaka bands.
    smallPacket: [503, 508, 612, 816, 955],
    // Tracking, which is what makes Economy into Standard.
    tracking: 198,
    // 17.43 to a kilogram, then 2.37 for each kilogram after it.
    parcel: [1743, 1980, 2217, 2454, 2691],
  };
}

type Run = {
  outcome: string;
  tally: Record<string, number>;
  failure: string | null;
};

async function sweep(request: APIRequestContext): Promise<Run> {
  // Always forced: the table is global and a sweep another scenario just ran would otherwise be fresh enough to skip.
  const started = await request.post(`/api/private/jobs/${job}/run?force=true`);
  expect(started.status(), await started.text()).toBe(202);

  await expect
    .poll(async () => (await statusOf(request)).lastRun?.outcome, { timeout: 60_000 })
    .not.toBe("running");
  return (await statusOf(request)).lastRun as Run;
}

async function statusOf(request: APIRequestContext) {
  const response = await request.get(`/api/private/jobs/${job}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as { lastRun: Run | null };
}

async function pricesOf(request: APIRequestContext, code: string): Promise<ShippingPricesPage> {
  const response = await request.get(`/api/private/shipping-prices?country=${encodeURIComponent(code)}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as ShippingPricesPage;
}

/** One service's bands, lightest first, as a band and its total: what a reader actually asks the table. */
function bandsOf(page: ShippingPricesPage, shipmentType: string, service: string) {
  return page.prices
    .filter((price: ShippingPriceRow) => price.shipmentType === shipmentType && price.service === service)
    .sort((one, other) => one.weightToGrams - other.weightToGrams)
    .map((price) => [price.weightFromGrams, price.weightToGrams, price.totalPrice]);
}

test("the sweep reads the provider's unordered ladder back into Sikpaka weight bands", async ({
  request,
  settings,
}, testInfo) => {
  const code = aDestinationCode(testInfo);
  await mockLatvijasPasts(settings, request, testInfo, [aTariff(code)]);

  expect((await sweep(request)).outcome).toBe("succeeded");

  const page = await pricesOf(request, code);
  expect(bandsOf(page, "SMALL_PACKET", "ECONOMY")).toEqual([
    [0, 20, 5.03],
    [21, 100, 5.08],
    [101, 500, 6.12],
    [501, 1000, 8.16],
    [1001, 2000, 9.55],
  ]);
});

test("Standard is the Economy base with tracking on top, and the two are stored apart", async ({
  request,
  settings,
}, testInfo) => {
  const code = aDestinationCode(testInfo);
  await mockLatvijasPasts(settings, request, testInfo, [aTariff(code)]);

  expect((await sweep(request)).outcome).toBe("succeeded");

  const page = await pricesOf(request, code);
  const standard = page.prices.find(
    (price) => price.shipmentType === "SMALL_PACKET" && price.service === "STANDARD" && price.weightToGrams === 500,
  );

  expect(standard).toMatchObject({ basePrice: 6.12, trackingFee: 1.98, totalPrice: 8.1 });

  // Economy is the same postage without the tracking, which is the whole of the difference between them.
  const economy = page.prices.find(
    (price) => price.shipmentType === "SMALL_PACKET" && price.service === "ECONOMY" && price.weightToGrams === 500,
  );
  expect(economy).toMatchObject({ basePrice: 6.12, trackingFee: 0, totalPrice: 6.12 });
});

test("a Paka is banded by the kilogram, from the first kilogram up to what the destination carries", async ({
  request,
  settings,
}, testInfo) => {
  const code = aDestinationCode(testInfo);
  await mockLatvijasPasts(settings, request, testInfo, [aTariff(code)]);

  expect((await sweep(request)).outcome).toBe("succeeded");

  const page = await pricesOf(request, code);
  expect(bandsOf(page, "PARCEL", "STANDARD_PLUS")).toEqual([
    [0, 1000, 17.43],
    [1001, 2000, 19.8],
    [2001, 3000, 22.17],
    [3001, 4000, 24.54],
    [4001, 5000, 26.91],
  ]);
});

test("the services a store does not buy are not stored", async ({ request, settings }, testInfo) => {
  const code = aDestinationCode(testInfo);
  await mockLatvijasPasts(settings, request, testInfo, [aTariff(code)]);

  expect((await sweep(request)).outcome).toBe("succeeded");

  const page = await pricesOf(request, code);
  // The provider also priced a courier, a parcel machine, the premium service and an insured parcel for this
  // destination. A store posting bricks buys none of them, and the table holds only the three that it does.
  expect(new Set(page.prices.map((price) => `${price.shipmentType}/${price.service}`))).toEqual(
    new Set(["SMALL_PACKET/ECONOMY", "SMALL_PACKET/STANDARD", "PARCEL/STANDARD_PLUS"]),
  );
});

test("a price the provider still states is confirmed rather than rewritten", async ({
  request,
  settings,
}, testInfo) => {
  const code = aDestinationCode(testInfo);
  await mockLatvijasPasts(settings, request, testInfo, [aTariff(code)]);

  const first = await sweep(request);
  expect(first.outcome).toBe("succeeded");
  expect(first.tally.added).toBe(15);
  expect(first.tally.changed).toBe(0);

  const validFrom = (await pricesOf(request, code)).prices.map((price) => price.validFrom).sort();

  const second = await sweep(request);
  expect(second.outcome).toBe("succeeded");
  expect(second.tally).toMatchObject({ added: 0, changed: 0, unchanged: 15, closed: 0 });

  // A confirmed price is the same row it was: it came into force when it first appeared, not when it was last read.
  expect((await pricesOf(request, code)).prices.map((price) => price.validFrom).sort()).toEqual(validFrom);
});

test("a price that has moved opens a new row and the destination reads the new one", async ({
  request,
  settings,
}, testInfo) => {
  const code = aDestinationCode(testInfo);
  await mockLatvijasPasts(settings, request, testInfo, [aTariff(code)]);
  expect((await sweep(request)).outcome).toBe("succeeded");

  const raised = aTariff(code);
  raised.smallPacket = [503, 508, 649, 816, 955];
  await mockLatvijasPasts(settings, request, testInfo, [raised]);

  const second = await sweep(request);
  expect(second.outcome).toBe("succeeded");
  // Two rows moved, the one band being priced under both Economy and Standard.
  expect(second.tally).toMatchObject({ added: 0, changed: 2, unchanged: 13, closed: 0 });

  const page = await pricesOf(request, code);
  expect(bandsOf(page, "SMALL_PACKET", "ECONOMY")).toEqual([
    [0, 20, 5.03],
    [21, 100, 5.08],
    [101, 500, 6.49],
    [501, 1000, 8.16],
    [1001, 2000, 9.55],
  ]);
});

test("a ladder the provider sends as an object keyed by position is read like any other", async ({
  request,
  settings,
}, testInfo) => {
  const code = aDestinationCode(testInfo);
  const tariff = aTariff(code);
  // Twelve real destinations arrive this way: PHP's encoding of an array whose keys stopped being consecutive, left
  // behind when the provider filtered the insured prices out of it. The bands in it are the same bands.
  tariff.parcelAsKeyedObject = true;
  await mockLatvijasPasts(settings, request, testInfo, [tariff]);

  expect((await sweep(request)).outcome).toBe("succeeded");

  expect(bandsOf(await pricesOf(request, code), "PARCEL", "STANDARD_PLUS")).toEqual([
    [0, 1000, 17.43],
    [1001, 2000, 19.8],
    [2001, 3000, 22.17],
    [3001, 4000, 24.54],
    [4001, 5000, 26.91],
  ]);
});

test("a destination whose ladder repeats itself is skipped rather than priced wrongly", async ({
  request,
  settings,
}, testInfo) => {
  const good = aDestinationCode(testInfo, "A");
  const repeated = aTariff(aDestinationCode(testInfo, "B"));
  // As the provider answers for St Helena: the same ten prices twice under one label. Read as a single ladder they
  // would be twenty one-kilogram bands, and every band after the first would carry the price of the one below it.
  repeated.parcelLadderRepeated = true;
  await mockLatvijasPasts(settings, request, testInfo, [aTariff(good), repeated]);

  const run = await sweep(request);
  expect(run.outcome).toBe("succeeded");
  expect(run.tally.skipped).toBe(1);

  // Nothing at all is stored for it - not the Sikpaka bands either, a destination being priced whole or not at all.
  expect((await pricesOf(request, repeated.code)).prices).toEqual([]);

  // And the destination beside it in the same batch is priced as usual.
  expect(bandsOf(await pricesOf(request, good), "PARCEL", "STANDARD_PLUS")).toEqual([
    [0, 1000, 17.43],
    [1001, 2000, 19.8],
    [2001, 3000, 22.17],
    [3001, 4000, 24.54],
    [4001, 5000, 26.91],
  ]);
});

test("a sweep that fails partway keeps the destinations it had already read", async ({
  request,
  settings,
}, testInfo) => {
  const kept = aTariff(aDestinationCode(testInfo, "A"));
  await mockLatvijasPasts(settings, request, testInfo, [kept]);
  expect((await sweep(request)).outcome).toBe("succeeded");

  // The provider now refuses the price request outright. Each destination is written in a transaction of its own,
  // so what an earlier sweep stored survives a later one failing - and so does the debug dock's record of the
  // traffic, which would otherwise be rolled back exactly when a reader wants to see what was sent.
  const wireMock = (await import("../support/wiremock")).WireMockApi.forTest(request, testInfo);
  await wireMock.addMethodHostMapping("POST", "/api/public/prices/by_country", {
    priority: 0,
    response: { status: 500, body: "provider is down" },
  });

  const failed = await sweep(request);
  expect(failed.outcome).toBe("failed");

  expect(bandsOf(await pricesOf(request, kept.code), "SMALL_PACKET", "ECONOMY")).toEqual([
    [0, 20, 5.03],
    [21, 100, 5.08],
    [101, 500, 6.12],
    [501, 1000, 8.16],
    [1001, 2000, 9.55],
  ]);
});

test("how long a service takes is stored as a fewest and a most, however the provider writes it", async ({
  request,
  settings,
}, testInfo) => {
  const ranged = aTariff(aDestinationCode(testInfo, "A"));
  ranged.deliveryDays = "15 - 20";
  const single = aTariff(aDestinationCode(testInfo, "B"));
  // What the provider writes where it offers one number rather than a range.
  single.deliveryDays = "16";
  await mockLatvijasPasts(settings, request, testInfo, [ranged, single]);

  expect((await sweep(request)).outcome).toBe("succeeded");

  expect((await pricesOf(request, ranged.code)).prices[0]).toMatchObject({ deliveryDaysMin: 15, deliveryDaysMax: 20 });
  // One number means the fewest and the most are the same, not that there is no estimate.
  expect((await pricesOf(request, single.code)).prices[0]).toMatchObject({ deliveryDaysMin: 16, deliveryDaysMax: 16 });
});

test("an estimate the provider merely reformats is not a change", async ({ request, settings }, testInfo) => {
  const tariff = aTariff(aDestinationCode(testInfo));
  tariff.deliveryDays = "15 - 20";
  await mockLatvijasPasts(settings, request, testInfo, [tariff]);
  expect((await sweep(request)).outcome).toBe("succeeded");

  // The same estimate, spaced the other way. The provider writes both across its own destinations, so storing the
  // string would close and reopen every row the day it tidied them up.
  tariff.deliveryDays = "15-20";
  await mockLatvijasPasts(settings, request, testInfo, [tariff]);
  expect((await sweep(request)).tally).toMatchObject({ added: 0, changed: 0, unchanged: 15 });

  // A different estimate is a change, and opens a new row as a changed price does.
  tariff.deliveryDays = "18-25";
  await mockLatvijasPasts(settings, request, testInfo, [tariff]);
  expect((await sweep(request)).tally).toMatchObject({ added: 0, changed: 15, unchanged: 0 });
  expect((await pricesOf(request, tariff.code)).prices[0]).toMatchObject({ deliveryDaysMin: 18, deliveryDaysMax: 25 });
});

test("the destination listing names what there are prices for", async ({ request, settings }, testInfo) => {
  const code = aDestinationCode(testInfo);
  const tariff = aTariff(code);
  await mockLatvijasPasts(settings, request, testInfo, [tariff]);
  expect((await sweep(request)).outcome).toBe("succeeded");

  const response = await request.get("/api/private/shipping-prices/countries");
  expect(response.status(), await response.text()).toBe(200);
  const countries = (await response.json()) as { code: string; name: string }[];

  expect(countries).toContainEqual({ code, name: tariff.name });
});

test("a destination there are no prices for is an empty answer and not an error", async ({ request }) => {
  const page = await pricesOf(request, "TNOTSWEPT");
  expect(page.prices).toEqual([]);
  expect(page.checkedAt).toBeNull();
});

test("a sweep whose ladder disagrees with a quoted weight is abandoned rather than stored", async ({
  request,
  settings,
}, testInfo) => {
  const code = aDestinationCode(testInfo);
  const tariff = aTariff(code);
  await mockLatvijasPasts(settings, request, testInfo, [tariff]);

  // The provider now quotes 500 g at a price its own ladder does not hold. Bands are read by where a price falls
  // once the ladder is sorted, so a provider that stopped pricing in weight order has to stop the sweep and not be
  // read wrongly in silence.
  const wireMock = (await import("../support/wiremock")).WireMockApi.forTest(request, testInfo);
  await wireMock.addMethodHostMapping("POST", "/api/public/prices/by_country", {
    priority: 0,
    request: { bodyPatterns: [{ contains: `"${code}"` }, { contains: '"weight":500' }] },
    response: {
      json: {
        workFlows: [
          {
            label: "parcel-economy-small",
            countryCode: code,
            shipmentSizeType: "small",
            weightCosts: [{ priceWithTax: 9999, insurance: false }],
            additionalServiceCosts: [],
          },
        ],
      },
    },
  });

  const run = await sweep(request);
  expect(run.outcome).toBe("failed");
  expect(run.failure).toContain("does not agree");

  expect((await pricesOf(request, code)).prices).toEqual([]);
});
