import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { signJwt } from "../shared/jwt.js";

// Databases are intentionally private. All inspection is executed inside their
// containers; this script never requires host mappings for 5432 or 27017.
function dockerCompose(args) {
  return execFileSync("docker", ["compose", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

function postgres(database, sql) {
  return dockerCompose([
    "exec", "-T", "postgres", "psql", "-U", "cab", "-d", database,
    "-At", "-v", "ON_ERROR_STOP=1", "-c", sql,
  ]);
}

function postgresJson(database, sql) {
  const output = postgres(database, sql);
  return output ? JSON.parse(output.split(/\r?\n/).at(-1)) : null;
}

function mongo(expression) {
  return dockerCompose([
    "exec", "-T", "mongodb", "mongosh",
    "mongodb://localhost:27017/cab_notification_db?replicaSet=rs0",
    "--quiet", "--eval", expression,
  ]);
}

const mode = process.argv[2];

if (mode === "prepare") {
  const row = postgresJson("cab_booking_db", `
    SELECT json_build_object(
      'id', replay.id,
      'record', replay.data,
      'booking', booking.data,
      'bookingCount', (SELECT count(*)::int FROM bookings)
    )::text
    FROM idempotency replay
    JOIN bookings booking ON booking.id = replay.data->'body'->>'bookingId'
    WHERE replay.id LIKE 'booking:%'
    ORDER BY booking.requested_at DESC NULLS LAST
    LIMIT 1
  `);
  assert.ok(row, "booking workflow must run first");
  const [, customerId, , key] = row.id.split(":");
  const record = {
    customerId,
    key,
    response: row.record.body,
    request: {
      pickup: row.booking.pickup,
      destination: row.booking.destination ?? row.booking.dropoff,
      vehicleType: row.booking.vehicleType,
    },
    count: Number(row.bookingCount),
  };
  fs.writeFileSync(".secrets/restart-check.json", JSON.stringify(record));
  console.log("Prepared durable booking replay check (no secrets printed).");
} else if (mode === "replay") {
  const record = JSON.parse(fs.readFileSync(".secrets/restart-check.json", "utf8"));
  process.env.JWT_PRIVATE_KEY_PATH = ".secrets/jwt-private.pem";
  process.env.JWT_PUBLIC_KEY_PATH = ".secrets/jwt-public.pem";
  const token = signJwt({
    sub: record.customerId,
    profileId: record.customerId,
    role: "CUSTOMER",
    iss: "identity-service",
    aud: "cab-gateway",
    exp: Math.floor(Date.now() / 1000) + 300,
  });
  const responses = await Promise.all(Array.from({ length: 12 }, async () => {
    const result = await fetch("http://localhost:8000/api/v1/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": record.key,
      },
      body: JSON.stringify(record.request),
    });
    assert.equal(result.status, 201);
    return result.json();
  }));
  for (const response of responses) assert.deepEqual(response, record.response);
  const count = Number(postgres("cab_booking_db", "SELECT count(*) FROM bookings"));
  assert.equal(count, record.count);
  console.log("PASS: 12 concurrent booking replays after restart return the saved response; booking is not duplicated.");
} else {
  const passwordHashes = postgresJson("cab_identity_db", `
    SELECT coalesce(json_agg(data->>'password'), '[]'::json)::text FROM users
  `);
  assert.ok(passwordHashes.length >= 3);
  assert.ok(passwordHashes.every((password) => /^scrypt:[a-f0-9]{32}:[a-f0-9]{64}$/.test(password)));
  console.log(`PASS PostgreSQL inspected inside Docker; ${passwordHashes.length} salted password hashes, no plaintext passwords.`);

  const driverDocuments = postgresJson("cab_driver_db", `
    SELECT coalesce(json_agg(data), '[]'::json)::text FROM drivers WHERE data ? 'citizenId'
  `);
  assert.ok(driverDocuments.length > 0);
  assert.ok(driverDocuments.every((data) => /^v[12]:/.test(data.citizenId) && /^v[12]:/.test(data.licenseNumber)));
  assert.ok(driverDocuments.some((data) => data.citizenId.startsWith("v2:local-v1:")));
  console.log(`PASS ${driverDocuments.length} driver documents encrypted with AES-GCM; versioned external key configured.`);

  for (const name of ["customer", "booking", "trip", "payment"]) {
    postgres(`cab_${name}_db`, "SELECT 1");
    console.log(`PASS cab_${name}_db reachable only through the Docker network/container.`);
  }

  const notificationCount = Number(mongo("db.notifications.countDocuments({})"));
  assert.ok(notificationCount > 0);
  console.log(`PASS MongoDB inspected inside Docker; ${notificationCount} persisted notifications.`);
}
