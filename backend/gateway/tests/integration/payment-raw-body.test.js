import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { createServer } from "node:http";

process.env.JWT_ALLOW_EPHEMERAL = "true";
process.env.INTERNAL_SERVICE_TOKEN = "test-service-token";
process.env.PAYMENT_CALLBACK_SECRET = "test-callback-secret";

const { createGatewayApp } = await import("../../src/app.js");
const { createApp } =
  await import("../../../services/payment-service/src/app.js");

async function listen(app) {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, port: server.address().port };
}

test("payment callback verifies the exact raw bytes forwarded by Gateway", async (t) => {
  process.env.SERVICE_NAME = "payment-service";
  const payment = await listen(createApp());
  process.env.SERVICE_URLS_JSON = JSON.stringify({
    "payment-service": `http://127.0.0.1:${payment.port}`,
  });
  const gateway = await listen(createGatewayApp());
  t.after(() => {
    gateway.server.close();
    payment.server.close();
  });

  const rawBody =
    '{"providerTxnRef":"missing","amountVnd":25000,"status":"SUCCESS"}';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto
    .createHmac("sha256", process.env.PAYMENT_CALLBACK_SECRET)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest("hex");
  const response = await fetch(
    `http://127.0.0.1:${gateway.port}/payments/callback`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Timestamp": timestamp,
        "X-Signature": signature,
      },
      body: rawBody,
    },
  );

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, "NOT_FOUND");
});
