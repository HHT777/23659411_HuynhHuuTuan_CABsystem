import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { registerRoutes } from "../services/booking-service/src/api/http/service.routes.js";

test("booking offers reach every nearby available driver and close after one accepts", async (t) => {
  const routes = new Map();
  const state = { bookings: new Map(), offers: new Map() };
  const notifications = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.includes("/internal/drivers/nearby")) {
      return { json: async () => [
        { driverId: "driver-1" },
        { driverId: "driver-2" },
        { driverId: "driver-2" },
      ] };
    }
    if (url.includes("/internal/trips")) return { json: async () => ({ tripId: "trip-1" }) };
    throw new Error(`Unexpected fetch: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  registerRoutes({
    get(path, handler) { routes.set(`GET ${path}`, handler); },
    post(path, handler) { routes.set(`POST ${path}`, handler); },
  }, {
    state,
    INTERNAL_TOKEN: "test-token",
    crypto: { randomUUID },
    requireUser: (request) => request.user,
    idempotent: () => true,
    saveIdempotency: () => {},
    notify: async (...args) => { notifications.push(args); },
    internalCall: async () => ({}),
    error: (res, status, code) => res.status(status).json({ error: { code } }),
    escapeHtml: (value) => value,
    distanceM: () => 1000,
    calculateFareVnd: () => 9000,
  });

  const response = () => ({
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  });
  const bookingResponse = response();
  await routes.get("POST /bookings")({
    user: { role: "CUSTOMER", profileId: "customer-1" },
    body: {
      pickup: { address: "Pickup", lat: 10.776, lng: 106.701 },
      destination: { address: "Destination", lat: 10.78, lng: 106.71 },
      vehicleType: "BIKE",
    },
  }, bookingResponse);
  assert.equal(bookingResponse.statusCode, 201);
  assert.equal(state.offers.size, 2);
  assert.deepEqual(notifications.filter((item) => item[1] === "BOOKING_OFFER").map((item) => item[0]), ["driver-1", "driver-2"]);

  const offersFor = async (driverId) => {
    const result = response();
    await routes.get("GET /offers")({ user: { role: "DRIVER", profileId: driverId } }, result);
    return result.body.items;
  };
  const first = await offersFor("driver-1");
  const second = await offersFor("driver-2");
  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  assert.equal(first[0].bookingId, bookingResponse.body.bookingId);
  assert.equal(second[0].bookingId, bookingResponse.body.bookingId);

  const accepted = response();
  await routes.get("POST /offers/:id/accept")({
    user: { role: "DRIVER", profileId: "driver-2" },
    params: { id: second[0].id },
  }, accepted);
  assert.equal(accepted.body.status, "ASSIGNED");
  assert.equal(state.bookings.get(bookingResponse.body.bookingId).driverId, "driver-2");
  assert.equal(state.offers.get(first[0].id).status, "CANCELED");
  assert.equal(state.offers.get(second[0].id).status, "ACCEPTED");
  assert.deepEqual(await offersFor("driver-1"), []);

  const lateAccept = response();
  await routes.get("POST /offers/:id/accept")({
    user: { role: "DRIVER", profileId: "driver-1" },
    params: { id: first[0].id },
  }, lateAccept);
  assert.equal(lateAccept.statusCode, 409);
  assert.equal(lateAccept.body.error.code, "OFFER_CLOSED");
});
