import type { APIRequestContext } from "@playwright/test";

import { expect, test } from "../support/api-test";
import {
  mansPastsPassword,
  mansPastsSession,
  mansPastsUsername,
  mockMansPasts,
  type MansPastsShipmentMock,
  type MansPastsShipmentRow,
} from "../support/manspasts";
import { WireMockApi, wireMockMode } from "../support/wiremock";

/**
 * Reading the Mans Pasts register through the client that reads it. Latvijas Pasts publishes no API for it, so what
 * these scenarios are about is the provider's own xlsx export arriving as the shipments it states — with the amounts,
 * weights and times it stated them in — and that reaching the export at all takes the sign-in it needs.
 *
 * <p>Whether reconciliation then matches a shipment to an order is a scenario of its own, driven through the
 * reconciliation endpoint.
 */

test.describe.configure({ mode: wireMockMode() });

async function shipmentsOf(
  request: APIRequestContext,
  page?: number,
): Promise<MansPastsShipmentRow[]> {
  const response = await request.get(
    page === undefined
      ? "/api/test/manspasts/shipments"
      : `/api/test/manspasts/shipments?page=${page}`,
  );
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as MansPastsShipmentRow[];
}

/** A tracked parcel with the customs content declaration a parcel leaving the EU carries. */
const declaredParcel: MansPastsShipmentMock = {
  barcode: "LS900000001LV",
  shipmentType: "Letter (items)",
  serviceType: "tracked",
  status: "processed",
  listNumber: "2400001",
  recipientName: "Edith Clarke",
  country: "AU",
  address: "12 Example Street, Queensland, Nambour, Austrālija, 4560",
  postalCode: "4560",
  notes: "Order #32400001",
  email: "edith.clarke@example.test",
  phone: "0400000001",
  contentName: "Lego Set",
  quantity: 1,
  weightKg: 0.261,
  value: 15.85,
  hsCode: "950300",
  originCountry: "DK",
  submittedAt: "02.09.2026 21:07:36",
  processedAt: "03.09.2026 07:15:02",
  weighedWeightKg: 0.257,
  postageFee: 10.23,
  totalAmount: 10.23,
  sender: "Example Bricks, SIA / Example iela 1, Rīga, LV-1001, Latvija",
  createdAt: "01.09.2026 13:33:37",
  emailNotice: "Sūtījumu saraksts apstrādāts: 03.09.2026 00:07:38",
};

/** An ordinary letter inside the EU, which carries no content declaration and no insurance. */
const plainLetter: MansPastsShipmentMock = {
  barcode: "UA900000002LV",
  shipmentType: "Letter (items)",
  serviceType: "ordinary",
  status: "sent",
  listNumber: "2400002",
  recipientName: "Hedy Lamarr",
  country: "AT",
  address: "Example weg 14, Tirol, Langkampfen, Austrija, 6336",
  postalCode: "6336",
  notes: "Order #32400002",
  submittedAt: "04.09.2026 09:18:38",
  weighedWeightKg: 0.003,
  postageFee: 5.41,
  totalAmount: 5.41,
  createdAt: "03.09.2026 08:00:00",
};

test("lists a page of the register as the export stated it", async ({
  request,
  settings,
}, testInfo) => {
  await mockMansPasts(settings, request, testInfo, [
    [declaredParcel, plainLetter],
  ]);

  const shipments = await shipmentsOf(request);

  // In the order the export listed them: the register is the provider's, and its own order is the newest first.
  expect(shipments.map((shipment) => shipment.barcode)).toEqual([
    "LS900000001LV",
    "UA900000002LV",
  ]);
  expect(shipments[0]).toMatchObject({
    shipmentType: "Letter (items)",
    serviceType: "tracked",
    status: "processed",
    listNumber: "2400001",
    recipientName: "Edith Clarke",
    country: "AU",
    postalCode: "4560",
    notes: "Order #32400001",
    email: "edith.clarke@example.test",
    phone: "0400000001",
    contentName: "Lego Set",
    quantity: 1,
    hsCode: "950300",
    originCountry: "DK",
    emailNotice: "Sūtījumu saraksts apstrādāts: 03.09.2026 00:07:38",
  });
});

test("states an amount to the cent and a weight to the gram", async ({
  request,
  settings,
}, testInfo) => {
  await mockMansPasts(settings, request, testInfo, [[declaredParcel]]);

  const shipments = await shipmentsOf(request);

  expect(shipments[0]).toMatchObject({
    value: 15.85,
    postageFee: 10.23,
    totalAmount: 10.23,
    // A letter of six grams rounded to the cent's scale would read as weighing nothing, so a weight keeps its gram.
    weightKg: 0.261,
    weighedWeightKg: 0.257,
  });
});

test("reads the times the export writes in its own format", async ({
  request,
  settings,
}, testInfo) => {
  await mockMansPasts(settings, request, testInfo, [[declaredParcel]]);

  const shipments = await shipmentsOf(request);

  expect(shipments[0]).toMatchObject({
    createdAt: "2026-09-01T13:33:37",
    submittedAt: "2026-09-02T21:07:36",
    processedAt: "2026-09-03T07:15:02",
  });
});

test("leaves a column the export left empty as nothing rather than as a zero", async ({
  request,
  settings,
}, testInfo) => {
  await mockMansPasts(settings, request, testInfo, [[plainLetter]]);

  const shipments = await shipmentsOf(request);

  expect(shipments[0]).toMatchObject({
    company: null,
    email: null,
    phone: null,
    contentName: null,
    quantity: null,
    weightKg: null,
    value: null,
    insuredAmount: null,
    insuranceFee: null,
    additionalServicesPrice: null,
    processedAt: null,
  });
});

test("signs in with the configured account and carries its session into the export", async ({
  request,
  settings,
}, testInfo) => {
  const wireMock = await mockMansPasts(settings, request, testInfo, [
    [plainLetter],
  ]);

  await shipmentsOf(request);

  const logins = await wireMock.findMethodHostRequests("POST", "/lv/login");
  expect(logins).toHaveLength(1);
  expect(logins[0].form().get("_username")).toBe(mansPastsUsername);
  expect(logins[0].form().get("_password")).toBe(mansPastsPassword);

  // The export is reached as the signed-in account, which is the whole reason the client signs in.
  const exports = await wireMock.findMethodHostRequests(
    "POST",
    "/lv/profile/orders/export",
  );
  expect(exports).toHaveLength(1);
  expect(exports[0].headerValue("Cookie")).toContain(
    `PHPSESSID=${mansPastsSession}`,
  );
});

test("asks the provider for the page the request named", async ({
  request,
  settings,
}, testInfo) => {
  const wireMock = await mockMansPasts(settings, request, testInfo, [
    [declaredParcel],
    [plainLetter],
  ]);

  const shipments = await shipmentsOf(request, 2);

  expect(shipments.map((shipment) => shipment.barcode)).toEqual([
    "UA900000002LV",
  ]);
  expect(await requestedPages(wireMock)).toEqual(["2"]);
});

test("reports a page the account has no shipments on as no shipments", async ({
  request,
  settings,
}, testInfo) => {
  await mockMansPasts(settings, request, testInfo, [[declaredParcel]]);

  const shipments = await shipmentsOf(request, 7);

  expect(shipments).toEqual([]);
});

/** The page the client asked the export for, as it wrote it into the request. */
async function requestedPages(wireMock: WireMockApi) {
  const requests = await wireMock.findMethodHostRequests(
    "POST",
    "/lv/profile/orders/export",
  );
  return requests.map(
    (request) =>
      new URL(request.url ?? "", "http://manspasts.test").searchParams.get(
        "page",
      ) ?? "",
  );
}
