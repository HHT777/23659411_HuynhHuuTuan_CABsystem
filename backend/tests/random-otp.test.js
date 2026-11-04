import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

process.env.JWT_ALLOW_EPHEMERAL = "true";
process.env.INTERNAL_SERVICE_TOKEN = "otp-test-token";
process.env.SERVICE_NAME = "driver-service";
process.env.STORAGE_MODE = "memory";
process.env.SANDBOX_MODE = "true";

const { createApp } = await import("../services/driver-service/src/app.js");

async function post(baseUrl, path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Token": "otp-test-token",
    },
    body: JSON.stringify(body),
  });
}

test("driver registration OTP is random and can be verified once", async (t) => {
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const first = await post(baseUrl, "/drivers/otp/request", { phone: "+84900000001" });
  const second = await post(baseUrl, "/drivers/otp/request", { phone: "+84900000002" });
  assert.equal(first.status, 202);
  assert.equal(second.status, 202);
  const firstOtp = await first.json();
  const secondOtp = await second.json();
  assert.match(firstOtp.otpCode, /^\d{6}$/);
  assert.match(secondOtp.otpCode, /^\d{6}$/);
  assert.notEqual(firstOtp.otpCode, secondOtp.otpCode);

  let response = await post(baseUrl, "/drivers/otp/verify", {
    phone: "+84900000001",
    challengeId: firstOtp.challengeId,
    code: firstOtp.otpCode,
  });
  assert.equal(response.status, 200);
  assert.equal(typeof (await response.json()).registrationToken, "string");

  response = await post(baseUrl, "/drivers/otp/verify", {
    phone: "+84900000001",
    challengeId: firstOtp.challengeId,
    code: firstOtp.otpCode,
  });
  assert.equal(response.status, 422);
});
