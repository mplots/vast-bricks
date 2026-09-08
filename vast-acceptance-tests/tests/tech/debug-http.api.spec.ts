import { expect, test } from "../support/api-test";
import {
  clearExchanges,
  downloadBody,
  providersOf,
  readExchanges,
  setRecording,
} from "../support/debug";
import {
  mansPastsPassword,
  mansPastsSession,
  mansPastsUsername,
  mockMansPasts,
} from "../support/manspasts";
import { mockReconciliationOrders } from "../support/reconciliation";
import {
  createVastUser,
  deleteVastUser,
  vastTestPassword,
} from "../support/vast-db";
import { wireMockMode } from "../support/wiremock";

test.describe.configure({ mode: wireMockMode() });

const brickOwlOrders = [
  {
    orderId: "test-order-0811",
    orderDate: "1786406400",
    view: { buyer_name: "Test Buyer Beta", sub_total: "6.00" },
  },
];

const reconcile = (request: Parameters<typeof readExchanges>[0]) =>
  request.get("/api/private/reconciliation/orders?month=2026-08");

test("records nothing until recording is armed", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: brickOwlOrders,
  });

  expect((await reconcile(request)).status()).toBe(200);

  expect(await readExchanges(request)).toEqual([]);
});

test("records the provider calls of a request made while recording", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: brickOwlOrders,
  });
  await setRecording(request, true);

  expect((await reconcile(request)).status()).toBe(200);

  const exchanges = await readExchanges(request);
  // Every provider the month touched is recorded, not just the one feature asked about.
  expect(providersOf(exchanges)).toEqual([
    "BrickLink",
    "BrickOwl",
    "Mans Pasts",
    "PayPal",
    "Stripe",
  ]);

  const orderList = exchanges.find((exchange) =>
    exchange.url.includes("/v1/order/list"),
  );
  expect(orderList?.provider).toBe("BrickOwl");
  expect(orderList?.statusCode).toBe(200);
  expect(JSON.parse(orderList?.responseBody ?? "")).toEqual([
    { order_id: "test-order-0811", order_date: "1786406400" },
  ]);

  // The credentials that crossed the wire are masked before anything is stored.
  const traffic = JSON.stringify(exchanges);
  expect(traffic).not.toContain("test-brickowl-api-key");
  expect(traffic).toContain("key=***");
});

test("does not show one user the traffic of another", async ({
  request,
  settings,
  baseURL,
  playwright,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: brickOwlOrders,
  });
  await setRecording(request, true);
  expect((await reconcile(request)).status()).toBe(200);
  expect(await readExchanges(request)).not.toEqual([]);

  // Same tenant on purpose: debug recording is scoped to the user who armed it, not to the tenant, and this
  // scenario is about the second user seeing nothing rather than about tenant isolation.
  const onlooker = await createVastUser(
    `debug-onlooker-${testInfo.workerIndex}-${Date.now()}@example.test`,
    settings.tenantId,
  );
  try {
    const login = await playwright.request.newContext({ baseURL });
    const loginResponse = await login.post("/api/account/login", {
      data: { email: onlooker.email, password: vastTestPassword },
    });
    const { serviceToken } = (await loginResponse.json()) as {
      serviceToken: string;
    };
    await login.dispose();

    const onlookerRequest = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {
        Accept: "application/json",
        Authorization: `Bearer ${serviceToken}`,
      },
    });
    try {
      // Recording is per user, so the traffic of somebody else's request is not theirs to read.
      expect(await readExchanges(onlookerRequest)).toEqual([]);
    } finally {
      await onlookerRequest.dispose();
    }
  } finally {
    await deleteVastUser(onlooker.id);
  }
});

test("clears the traffic it recorded", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: brickOwlOrders,
  });
  await setRecording(request, true);
  expect((await reconcile(request)).status()).toBe(200);
  expect(await readExchanges(request)).not.toEqual([]);

  await clearExchanges(request);

  expect(await readExchanges(request)).toEqual([]);
});

test("masks a credential the provider issued mid-operation", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
      // Credentials no other scenario uses, so BrickLink's session is created here rather than reused from the
      // client's cache and the session request is actually part of what gets recorded.
      clientToken: "debug-scenario-client-token",
      sessionToken: "debug-scenario-session-token",
    },
  });
  await setRecording(request, true);

  expect((await reconcile(request)).status()).toBe(200);

  const exchanges = await readExchanges(request);
  const session = exchanges.filter((exchange) =>
    exchange.url.includes("/verify-and-create-session"),
  );
  expect(session).not.toHaveLength(0);

  // The configured token is sent in the session request; the session token comes back in its response, so it is
  // only known after that response was already recorded.
  expect(session[0].requestBody).toContain("***");
  expect(session[0].responseBody).toContain("***");
  const traffic = JSON.stringify(exchanges);
  expect(traffic).not.toContain("debug-scenario-client-token");
  expect(traffic).not.toContain("debug-scenario-session-token");
});

/**
 * A provider reached for one page of the Mans Pasts register, which is the one provider here that answers with a
 * file. It is asked for through the test-only endpoint rather than through a screen: what these two scenarios are
 * about is what the dock does with a body that is not text, and any call that answers with one will do.
 */
const readShipmentRegister = (request: Parameters<typeof readExchanges>[0]) =>
  request.get("/api/test/manspasts/shipments");

test("records a provider's sign-in and the call it was needed for as one operation", async ({
  request,
  settings,
}, testInfo) => {
  await mockMansPasts(settings, request, testInfo, [[]]);
  await setRecording(request, true);

  expect((await readShipmentRegister(request)).status()).toBe(200);

  // One recorded operation is one client method however many requests it takes: reaching the register takes the
  // sign-in before it, and both are that provider's traffic for this request.
  const exchanges = await readExchanges(request);
  expect(providersOf(exchanges)).toEqual(["Mans Pasts"]);
  expect(
    exchanges.map((exchange) => exchange.url.replace(/^https?:\/\/[^/]+/, "")),
  ).toEqual(["/lv/login", "/lv/profile/orders/export?page=1"]);

  const login = exchanges[0];
  expect(login.requestBody).toContain(`_username=${mansPastsUsername}`);
  // The password is what the client knows it sent, and the session it buys stands in for it once issued.
  expect(login.requestBody).toContain("_password=***");
  const traffic = JSON.stringify(exchanges);
  expect(traffic).not.toContain(mansPastsPassword);
  expect(traffic).not.toContain(mansPastsSession);
});

test("hands a recorded body that was not text over as the file it was", async ({
  request,
  settings,
}, testInfo) => {
  await mockMansPasts(settings, request, testInfo, [[]]);
  await setRecording(request, true);

  expect((await readShipmentRegister(request)).status()).toBe(200);

  const exported = (await readExchanges(request)).find((exchange) =>
    exchange.url.includes("/lv/profile/orders/export"),
  );
  // The export is a spreadsheet: decoded as text it is a screenful of replacement characters, and its NUL bytes
  // cannot be stored in a text column at all. So the body carries a note and the file is kept beside it.
  expect(exported?.responseBody).toMatch(/^\[\d+ bytes of /);
  expect(exported?.responseFile).toMatchObject({
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: `mans-pasts-${exported?.id}-response.xlsx`,
  });

  const download = await downloadBody(request, exported!.id, "response");

  expect(download.contentType).toContain(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  expect(download.disposition).toContain("attachment");
  expect(download.disposition).toContain(exported!.responseFile!.filename);
  // The bytes the provider sent, not a rendering of them: a zip header is what an xlsx starts with.
  expect(download.bytes.subarray(0, 2).toString("latin1")).toBe("PK");
  expect(download.bytes.length).toBe(exported!.responseFile!.size);
});
