import type { APIRequestContext, TestInfo } from "@playwright/test";

import type { SettingsOverrides } from "./api-test";
import { WireMockApi } from "./wiremock";
import { xlsxOf, type XlsxCell } from "./xlsx";

/**
 * Mans Pasts's own protocol, so a scenario states the shipments it is about and nothing of the provider: the
 * credentials that reach WireMock, the sign-in that answers with a session cookie, and the xlsx the profile's export
 * hands over a page at a time.
 *
 * <p>Latvijas Pasts publishes no API for the register a store sees under its own account, so the provider is reached
 * as a signed-in person — which is what makes the session cookie part of the protocol rather than an implementation
 * detail: an export asked for without one is answered with the login form.
 *
 * <p>Two kinds of scenario mock it: the logic tests that read one page of the register through the client, and the
 * reconciliation ones, which collect it as one source among several. So the stubbing is a function of its own and the
 * mock that resets WireMock first is the one the logic tests use.
 */

export const mansPastsUsername = "manspasts-test-user";
export const mansPastsPassword = "manspasts-test-password";
export const mansPastsSession = "manspasts-test-session";

/** One shipment of the register, as a scenario states it. Everything left out is a column the export left empty. */
export type MansPastsShipmentMock = {
  barcode?: string;
  shipmentType?: string;
  serviceType?: string;
  status?: string;
  listNumber?: string;
  recipientName?: string;
  company?: string;
  country?: string;
  address?: string;
  postalCode?: string;
  notes?: string;
  groups?: string;
  email?: string;
  phone?: string;
  contentName?: string;
  quantity?: number;
  weightKg?: number;
  value?: number;
  hsCode?: string;
  originCountry?: string;
  additionalServices?: string;
  additionalServicesPrice?: number;
  insuredAmount?: number;
  insuranceFee?: number;
  /** As the export writes an instant: `08.09.2026 19:11:13`. */
  submittedAt?: string;
  processedAt?: string;
  weighedWeightKg?: number;
  postageFee?: number;
  totalAmount?: number;
  sender?: string;
  createdAt?: string;
  emailNotice?: string;
};

/**
 * The headings the export writes over its columns, in the order it writes them. They are Latvian and they are what
 * the client reads a column by, so they are stated here exactly as the provider states them.
 */
const headings = [
  "Svītrkods",
  "Sūtījuma tips",
  "Sūtījuma veids",
  "Statuss",
  "Saraksta nr.",
  "Vārds, uzvārds",
  "Uzņēmums",
  "Valsts",
  "Adrese",
  "Pasta indekss",
  "Piezīmes",
  "Grupas",
  "E-pasts",
  "Tālruņa numurs",
  "Saturs",
  "Skaits",
  "Svars (kg)",
  "Vērtība (€)",
  "HS kods",
  "Izcelsmes valsts",
  "Papildpakalpojumi",
  "Papildpakalpojumu cena",
  "Apdrošināšana (€)",
  "Apdrošināšanas maksa",
  "Nodots LP",
  "Apstrādāts LP",
  "Svērtais svars (kg)",
  "Nosūtīšanas maksa",
  "Kopā summa",
  "Sūtītājs",
  "Izveidots",
  "Izsūtīts e-pasts",
];

/** One shipment as the row the export writes it as, under the headings above and in their order. */
function row(shipment: MansPastsShipmentMock): XlsxCell[] {
  return [
    shipment.barcode,
    shipment.shipmentType,
    shipment.serviceType,
    shipment.status,
    shipment.listNumber,
    shipment.recipientName,
    shipment.company,
    shipment.country,
    shipment.address,
    shipment.postalCode,
    shipment.notes,
    shipment.groups,
    shipment.email,
    shipment.phone,
    shipment.contentName,
    shipment.quantity,
    shipment.weightKg,
    shipment.value,
    shipment.hsCode,
    shipment.originCountry,
    shipment.additionalServices,
    shipment.additionalServicesPrice,
    shipment.insuredAmount,
    shipment.insuranceFee,
    shipment.submittedAt,
    shipment.processedAt,
    shipment.weighedWeightKg,
    shipment.postageFee,
    shipment.totalAmount,
    shipment.sender,
    shipment.createdAt,
    shipment.emailNotice,
  ];
}

/** The export as Mans Pasts hands it over: the headings, then one row per shipment. */
function mansPastsExport(shipments: MansPastsShipmentMock[]): Buffer {
  return xlsxOf([headings, ...shipments.map(row)]);
}

/**
 * Mocks Mans Pasts for one scenario: the credentials and base URL that reach WireMock, the sign-in, and one export
 * per page stated. A page beyond the ones stated is exported as the headings alone, which is what the provider
 * answers for a page the account has no shipments on.
 */
export async function mockMansPasts(
  settings: SettingsOverrides,
  request: APIRequestContext,
  testInfo: TestInfo,
  pages: MansPastsShipmentMock[][],
) {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();
  await stubMansPasts(wireMock, settings, pages);
  return wireMock;
}

/**
 * Points the client at WireMock and stubs the sign-in and one export per page stated. A page beyond the ones stated
 * is exported as the headings alone, which is what the provider answers for a page the account has no shipments on —
 * and what stops the source walking pages forever.
 */
export async function stubMansPasts(
  wireMock: WireMockApi,
  settings: SettingsOverrides,
  pages: MansPastsShipmentMock[][],
) {
  await stubSettings(settings, wireMock, mansPastsPassword);
  await stubLogin(wireMock);
  for (const [pageIndex, shipments] of pages.entries()) {
    await stubExport(wireMock, pageIndex + 1, shipments);
  }
  // Any other page: the export the account has nothing on. Lower precedence than the pages stated above.
  await stubAnyExport(wireMock, []);
}

/**
 * Stubs a sign-in Mans Pasts refuses, which it does by sending the login form back rather than by failing. The
 * configured password is one the login stub does not accept, so the client is refused as it would be for real.
 */
export async function stubMansPastsRefusedLogin(
  wireMock: WireMockApi,
  settings: SettingsOverrides,
) {
  await stubSettings(settings, wireMock, "the-wrong-password");
  await wireMock.addMethodHostMapping("POST", "/lv/login", {
    response: {
      status: 302,
      headers: {
        Location: "/lv/login",
        "Set-Cookie": `PHPSESSID=${mansPastsSession}; path=/; HttpOnly`,
      },
    },
  });
}

async function stubSettings(
  settings: SettingsOverrides,
  wireMock: WireMockApi,
  password: string,
) {
  await settings.set("VAST_MANSPASTS_BASE_URL", wireMock.baseUrl);
  await settings.setSecret("VAST_MANSPASTS_USERNAME", mansPastsUsername);
  await settings.setSecret("VAST_MANSPASTS_PASSWORD", password);
}

/**
 * The sign-in, which answers with the session cookie the export has to carry back. The credentials are asserted, so
 * a client that sends none misses the stub instead of passing unauthenticated.
 */
async function stubLogin(wireMock: WireMockApi) {
  await wireMock.addMethodHostMapping("POST", "/lv/login", {
    request: {
      bodyPatterns: [
        { contains: `_username=${mansPastsUsername}` },
        { contains: `_password=${mansPastsPassword}` },
      ],
    },
    response: {
      // Mans Pasts answers a login either way with a redirect; this is the one that signed in.
      status: 302,
      headers: {
        Location: "/lv/profile",
        "Set-Cookie": `PHPSESSID=${mansPastsSession}; path=/; HttpOnly`,
      },
    },
  });
}

async function stubExport(
  wireMock: WireMockApi,
  page: number,
  shipments: MansPastsShipmentMock[],
) {
  await wireMock.addMethodHostMapping("POST", "/lv/profile/orders/export", {
    priority: 1,
    request: {
      headers: { Cookie: { contains: `PHPSESSID=${mansPastsSession}` } },
      queryParameters: { page: { equalTo: String(page) } },
    },
    response: exportResponse(shipments),
  });
}

async function stubAnyExport(
  wireMock: WireMockApi,
  shipments: MansPastsShipmentMock[],
) {
  await wireMock.addMethodHostMapping("POST", "/lv/profile/orders/export", {
    priority: 10,
    request: {
      headers: { Cookie: { contains: `PHPSESSID=${mansPastsSession}` } },
    },
    response: exportResponse(shipments),
  });
}

function exportResponse(shipments: MansPastsShipmentMock[]) {
  return {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="OrderExport.xlsx"',
    },
    base64Body: mansPastsExport(shipments).toString("base64"),
  };
}

/** One page of the register as the client reads it, which is what the test-only endpoint states. */
export type MansPastsShipmentRow = {
  barcode: string | null;
  shipmentType: string | null;
  serviceType: string | null;
  status: string | null;
  listNumber: string | null;
  recipientName: string | null;
  company: string | null;
  country: string | null;
  address: string | null;
  postalCode: string | null;
  notes: string | null;
  groups: string | null;
  email: string | null;
  phone: string | null;
  contentName: string | null;
  quantity: number | null;
  weightKg: number | null;
  value: number | null;
  hsCode: string | null;
  originCountry: string | null;
  additionalServices: string | null;
  additionalServicesPrice: number | null;
  insuredAmount: number | null;
  insuranceFee: number | null;
  submittedAt: string | null;
  processedAt: string | null;
  weighedWeightKg: number | null;
  postageFee: number | null;
  totalAmount: number | null;
  sender: string | null;
  createdAt: string | null;
  emailNotice: string | null;
};
