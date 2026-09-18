import type { APIRequestContext, TestInfo } from "@playwright/test";

import type { SettingsOverrides } from "./api-test";
import { WireMockApi } from "./wiremock";

/**
 * The European Central Bank's own daily reference rate feed, so a scenario states the rates it is about rather than
 * the XML shape they arrive in.
 *
 * <p>The feed states one day at a time - one dated `<Cube>` wrapping one `<Cube currency="..." rate="..."/>` per
 * quoted currency - which is the whole of what is stubbed here.
 */

/** ISO 4217's own code for testing purposes, so a scenario's rows are never mistaken for a real currency's. */
export const TEST_CURRENCY = "XTS";

/**
 * A reference date no other scenario uses, so a sync's day-level dedupe cannot mistake one scenario's day for
 * another's. Comfortably in the past: the ECB has never published for it and never will.
 */
export function anEcbRateDate(testInfo: TestInfo): string {
  const unique = `${testInfo.workerIndex}${testInfo.parallelIndex}${Date.now()}${Math.random()}`
    .replace(/\D/g, "")
    .slice(-8)
    .padStart(8, "0");
  const dayOfYear = 1 + (Number(unique.slice(0, 3)) % 365);
  const year = 1970 + (Number(unique.slice(3)) % 30);
  const date = new Date(Date.UTC(year, 0, dayOfYear));
  return date.toISOString().slice(0, 10);
}

/** Points the sync at WireMock and stubs one day's daily rates document. */
export async function mockEcb(
  settings: SettingsOverrides,
  request: APIRequestContext,
  testInfo: TestInfo,
  rateDate: string,
  rates: Record<string, string>,
) {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();
  await settings.set("VAST_ECB_BASE_URL", wireMock.baseUrl);

  await wireMock.addMethodHostMapping("GET", "/stats/eurofxref/eurofxref-daily.xml", {
    response: {
      headers: { "Content-Type": "text/xml;charset=utf-8" },
      body: dailyRatesXml(rateDate, rates),
    },
  });
  return wireMock;
}

function dailyRatesXml(rateDate: string, rates: Record<string, string>): string {
  const cubes = Object.entries(rates)
    .map(([currency, rate]) => `<Cube currency='${currency}' rate='${rate}'/>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
  <gesmes:subject>Reference rates</gesmes:subject>
  <gesmes:Sender><gesmes:name>European Central Bank</gesmes:name></gesmes:Sender>
  <Cube><Cube time='${rateDate}'>${cubes}</Cube></Cube>
</gesmes:Envelope>`;
}
