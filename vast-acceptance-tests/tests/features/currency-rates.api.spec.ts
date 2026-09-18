import type { APIRequestContext } from "@playwright/test";

import { expect, test } from "../support/api-test";
import { anEcbRateDate, mockEcb, TEST_CURRENCY } from "../support/ecb";
import { findCurrencyRates } from "../support/vast-db";

/**
 * The ECB currency rate sync and the table it fills.
 *
 * <p>The table is global rather than tenant-owned - a published reference rate is the same for every store - so a
 * scenario cannot rely on its tenant to keep its rows apart from the scenarios beside it. Each states a rate date of
 * its own instead, which is what the sync's own day-level dedupe keys on.
 */

const job = "currency-rate-sync";

type Run = {
  outcome: string;
  tally: Record<string, number>;
  failure: string | null;
};

async function sync(request: APIRequestContext): Promise<Run> {
  // Always forced: the table is global and a sync another scenario just ran would otherwise be fresh enough to skip.
  const started = await request.post(`/api/private/jobs/${job}/run?force=true`);
  expect(started.status(), await started.text()).toBe(202);

  await expect
    .poll(async () => (await statusOf(request)).lastRun?.outcome, { timeout: 30_000 })
    .not.toBe("running");
  return (await statusOf(request)).lastRun as Run;
}

async function statusOf(request: APIRequestContext) {
  const response = await request.get(`/api/private/jobs/${job}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as { lastRun: Run | null };
}

test("a day's rates are synced into the table", async ({ request, settings }, testInfo) => {
  const rateDate = anEcbRateDate(testInfo);
  await mockEcb(settings, request, testInfo, rateDate, { [TEST_CURRENCY]: "1.2345", USD: "1.0876" });

  const run = await sync(request);
  expect(run.outcome).toBe("succeeded");
  expect(run.tally).toMatchObject({ added: 2, skipped: 0 });

  const stored = await findCurrencyRates(rateDate);
  expect(stored).toContainEqual({ currency: TEST_CURRENCY, rateDate, rate: "1.234500" });
  expect(stored).toContainEqual({ currency: "USD", rateDate, rate: "1.087600" });
});

test("a day already stored is not synced again", async ({ request, settings }, testInfo) => {
  const rateDate = anEcbRateDate(testInfo);
  await mockEcb(settings, request, testInfo, rateDate, { [TEST_CURRENCY]: "1.2345" });

  const first = await sync(request);
  expect(first.outcome).toBe("succeeded");
  expect(first.tally).toMatchObject({ added: 1, skipped: 0 });

  // The ECB answers the same day again, as it does over a weekend. Read as a new day this would collide with the
  // row already there instead of leaving it alone.
  const second = await sync(request);
  expect(second.outcome).toBe("succeeded");
  expect(second.tally).toMatchObject({ added: 0, skipped: 1 });

  expect(await findCurrencyRates(rateDate)).toEqual([{ currency: TEST_CURRENCY, rateDate, rate: "1.234500" }]);
});

test("a firing this soon after another is skipped as fresh unless forced", async ({
  request,
  settings,
}, testInfo) => {
  const rateDate = anEcbRateDate(testInfo);
  await mockEcb(settings, request, testInfo, rateDate, { [TEST_CURRENCY]: "1.2345" });
  expect((await sync(request)).outcome).toBe("succeeded");

  // Unforced this time: the table was just synced, so a second tenant's firing is expected to find it fresh and do
  // nothing at all rather than asking the ECB again.
  const started = await request.post(`/api/private/jobs/${job}/run`);
  expect(started.status(), await started.text()).toBe(202);

  await expect
    .poll(async () => (await statusOf(request)).lastRun?.outcome, { timeout: 30_000 })
    .not.toBe("running");
  const run = (await statusOf(request)).lastRun as Run;
  expect(run.outcome).toBe("succeeded");
  expect(run.tally).toMatchObject({ "skipped-fresh": 1 });
});
