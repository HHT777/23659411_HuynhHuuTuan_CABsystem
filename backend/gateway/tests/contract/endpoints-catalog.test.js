import assert from "node:assert/strict";
import test from "node:test";
import { endpointCatalog, publicEndpointCatalog } from "../../src/routes/endpoints.routes.js";
import { targetFor } from "../../src/app.js";

test("every service declares an endpoint catalog", () => {
  assert.deepEqual(Object.keys(endpointCatalog).sort(), [
    "booking-service",
    "customer-service",
    "driver-service",
    "identity-service",
    "notification-service",
    "payment-service",
    "trip-service",
  ]);
  for (const [service, endpoints] of Object.entries(endpointCatalog)) {
    assert.ok(endpoints.length >= 5, `${service} must describe its HTTP surface`);
    assert.ok(endpoints.some(({ path }) => path === "/health"));
    assert.ok(endpoints.some(({ path }) => path === "/ready"));
    assert.ok(endpoints.some(({ path }) => path === "/endpoints"));
  }
});

test("every public endpoint is routed by Gateway to its owner", () => {
  const publicCatalog = publicEndpointCatalog();
  const seen = new Set();
  for (const [service, endpoints] of Object.entries(publicCatalog)) {
    for (const endpoint of endpoints) {
      const concretePath = endpoint.path.replaceAll(":id", "test-id");
      assert.equal(targetFor(concretePath), service, `${endpoint.method} ${endpoint.path}`);
      const key = `${endpoint.method} ${endpoint.path}`;
      assert.ok(!seen.has(key), `duplicate public endpoint ${key}`);
      seen.add(key);
      assert.equal(endpoint.url, `http://localhost:8000${endpoint.path}`);
    }
  }
  assert.ok(seen.size >= 30);
});
