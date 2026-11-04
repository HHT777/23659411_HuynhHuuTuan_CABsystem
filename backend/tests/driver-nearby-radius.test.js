import assert from "node:assert/strict";
import test from "node:test";
import { registerRoutes } from "../services/driver-service/src/api/http/service.routes.js";

test("nearby and dispatch default to a 3 km radius", () => {
  const routes = new Map();
  const app = {
    get(path, handler) { routes.set(path, handler); },
    post() {},
    put() {},
  };
  const drivers = new Map([
    ["inside", { id: "inside", fullName: "Inside", vehicleType: "BIKE", status: "ONLINE", lat: 2.9, lng: 0 }],
    ["outside", { id: "outside", fullName: "Outside", vehicleType: "BIKE", status: "ONLINE", lat: 3.1, lng: 0 }],
  ]);
  registerRoutes(app, {
    state: { drivers },
    distanceM: (point, driver) => Math.round(Math.abs(point.lat - driver.lat) * 1000),
    requireUser: () => ({ role: "CUSTOMER" }),
    escapeHtml: (value) => value,
  });

  const call = (path, query) => {
    let result;
    routes.get(path)({ query }, { json(value) { result = value; return this; } });
    return result;
  };
  const query = { lat: "0", lng: "0" };
  assert.deepEqual(call("/internal/drivers/nearby", query).map((driver) => driver.driverId), ["inside"]);
  assert.deepEqual(call("/drivers/nearby", query).items.map((driver) => driver.id), ["inside"]);
  assert.equal(call("/drivers/nearby", query).total, 1);
  assert.equal(call("/drivers/nearby", { ...query, radius: "3200" }).total, 2);
});
