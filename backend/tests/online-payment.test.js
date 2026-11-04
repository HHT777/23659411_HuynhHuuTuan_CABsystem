import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

process.env.JWT_ALLOW_EPHEMERAL = "true";
process.env.INTERNAL_SERVICE_TOKEN = "payment-test-token";
process.env.SERVICE_NAME = "payment-service";
process.env.STORAGE_MODE = "memory";

const nativeFetch = globalThis.fetch;
let paidCalls = 0;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url.startsWith("http://127.0.0.1:")) return nativeFetch(input, init);
  if (url.endsWith("/payable"))
    return Response.json({
      customerId: "customer-payment-test",
      status: "COMPLETED",
      paymentStatus: "UNPAID",
      fare: { amountVnd: 18_000, currency: "VND" },
    });
  if (url.endsWith("/paid")) {
    paidCalls += 1;
    return Response.json({ tripId: "trip-payment-test", paymentStatus: "PAID" });
  }
  throw new Error(`unexpected fetch: ${url}`);
};

const { signJwt } = await import("../shared/jwt.js");
const { createApp } = await import("../services/payment-service/src/app.js");

const now = Math.floor(Date.now() / 1000);
const token = signJwt({
  sub: "customer-payment-test",
  profileId: "customer-payment-test",
  role: "CUSTOMER",
  iss: "identity-service",
  aud: "cab-gateway",
  iat: now,
  exp: now + 300,
});

async function request(baseUrl, method, path, body, idempotencyKey) {
  return nativeFetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Service-Token": "payment-test-token",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test("PC19 creates PENDING online payment then completes trip after sandbox callback", async (t) => {
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    globalThis.fetch = nativeFetch;
    server.close();
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  let response = await request(
    baseUrl,
    "POST",
    "/payments",
    { tripId: "trip-payment-test", method: "ONLINE" },
    "payment-create",
  );
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.equal(created.status, "PENDING");
  assert.equal(created.amountVnd, 18_000);

  response = await request(
    baseUrl,
    "POST",
    `/payments/${created.paymentId}/sandbox-confirm`,
    { scenario: "SUCCESS" },
    "payment-confirm",
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).result, "COMPLETED");
  assert.equal(paidCalls, 1);

  response = await request(baseUrl, "GET", `/payments/${created.paymentId}`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "COMPLETED");

  response = await request(
    baseUrl,
    "POST",
    `/payments/${created.paymentId}/sandbox-confirm`,
    { scenario: "SUCCESS" },
    "payment-confirm",
  );
  assert.equal(response.status, 200);
  assert.equal(paidCalls, 1);
});
