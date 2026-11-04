import assert from "node:assert/strict";
import test from "node:test";
import { calculateFareVnd } from "../shared/service-runtime.js";

test("PC19 fare charges 900 VND for every started 100 meters", () => {
  assert.equal(calculateFareVnd(1), 900);
  assert.equal(calculateFareVnd(100), 900);
  assert.equal(calculateFareVnd(101), 1800);
  assert.equal(calculateFareVnd(1000), 9000);
});

test("PC19 fare rejects non-positive and invalid distances", () => {
  assert.equal(calculateFareVnd(0), 0);
  assert.equal(calculateFareVnd(-100), 0);
  assert.equal(calculateFareVnd("invalid"), 0);
});
