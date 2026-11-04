import assert from "node:assert/strict";
import test from "node:test";
import { registerRoutes } from "../services/driver-service/src/api/http/service.routes.js";

test("driver registration accepts five fields and uses the verified phone", async () => {
  const routes = new Map();
  const app = {
    get() {},
    put() {},
    post(path, handler) { routes.set(path, handler); },
  };
  const driverId = "test-driver-id";
  const phone = "+84901234567";
  const state = {
    drivers: new Map(),
    users: new Map(),
    idempotency: new Map([[`registration:${driverId}`, { phone, expiresAt: Date.now() + 60_000 }]]),
  };
  registerRoutes(app, {
    state,
    crypto: { randomUUID: () => driverId },
    parseToken: () => ({ profileId: driverId, role: "DRIVER" }),
    idempotent: () => true,
    error: (response, status, code) => response.status(status).json({ code }),
    escapeHtml: (value) => value,
    hashPassword: (value) => `hashed:${value}`,
    encryptField: (value) => `encrypted:${value}`,
    saveIdempotency() {},
    INTERNAL_TOKEN: "test-token",
  });
  const body = {
    fullName: "Test Driver",
    email: "driver@example.com",
    password: "secret123",
    vehicleType: "BIKE",
    plate: "TEST-123",
  };
  const response = () => ({
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  });
  const request = (value) => ({ body: value, get: () => "registration-token" });
  const originalFetch = globalThis.fetch;
  let account;
  globalThis.fetch = async (_url, options) => {
    account = JSON.parse(options.body);
    return { ok: true };
  };
  try {
    const missingEmail = response();
    await routes.get("/drivers/register")(request({ ...body, email: undefined }), missingEmail);
    assert.equal(missingEmail.statusCode, 400);

    const wrongPhone = response();
    await routes.get("/drivers/register")(request({ ...body, phone: "+84909999999" }), wrongPhone);
    assert.equal(wrongPhone.statusCode, 401);

    const registered = response();
    await routes.get("/drivers/register")(request(body), registered);
    assert.equal(registered.statusCode, 201);
    assert.equal(registered.body.status, "PENDING_APPROVAL");
    assert.equal(state.drivers.get(driverId).citizenId, undefined);
    assert.equal(state.drivers.get(driverId).licenseNumber, undefined);
    assert.equal(state.users.get(driverId).phone, phone);
    assert.equal(account.phone, phone);
    assert.equal(account.email, body.email);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
