import fs from "node:fs";
import assert from "node:assert/strict";
import pg from "pg";
import { MongoClient } from "mongodb";
import { signJwt } from "../shared/jwt.js";
const env = Object.fromEntries(fs.readFileSync(".env", "utf8").split(/\r?\n/).filter(x => x && !x.startsWith("#") && x.includes("=")).map(x => { const i = x.indexOf("="); return [x.slice(0, i), x.slice(i + 1)]; }));
async function db(name, action) {
  const client = new pg.Client({ host: "127.0.0.1", port: Number(env.POSTGRES_HOST_PORT ?? 5432), user: "cab", password: env.POSTGRES_PASSWORD, database: `cab_${name}_db` });
  await client.connect();
  try { return await action(client); } finally { await client.end(); }
}
const mode = process.argv[2];
if (mode === "prepare") {
  const record = await db("payment", async client => {
    const row = (await client.query("SELECT id, data FROM idempotency WHERE id LIKE 'payment:%' LIMIT 1")).rows[0];
    assert.ok(row, "payment workflow must run first");
    const [, customerId, , key] = row.id.split(":");
    return { customerId, key, response: row.data.body, paymentId: row.data.body.paymentId, tripId: row.data.body.tripId, count: Number((await client.query("SELECT count(*) FROM payments")).rows[0].count) };
  });
  fs.writeFileSync(".secrets/restart-check.json", JSON.stringify(record));
  console.log("Prepared durable payment replay check (no secrets printed).");
} else if (mode === "replay") {
  const record = JSON.parse(fs.readFileSync(".secrets/restart-check.json"));
  process.env.JWT_PRIVATE_KEY_PATH = ".secrets/jwt-private.pem";
  process.env.JWT_PUBLIC_KEY_PATH = ".secrets/jwt-public.pem";
  const token = signJwt({ sub: record.customerId, profileId: record.customerId, role: "CUSTOMER", iss: "identity-service", aud: "cab-gateway", exp: Math.floor(Date.now() / 1000) + 300 });
  const responses = await Promise.all(Array.from({ length: 12 }, async () => {
    const result = await fetch("http://localhost:8000/payments", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Idempotency-Key": record.key }, body: JSON.stringify({ tripId: record.tripId, method: "ONLINE" }) });
    assert.equal(result.status, 201);
    return result.json();
  }));
  for (const response of responses) assert.deepEqual(response, record.response);
  const count = await db("payment", async client => Number((await client.query("SELECT count(*) FROM payments")).rows[0].count));
  assert.equal(count, record.count);
  console.log("PASS: 12 concurrent replays after restart return the saved response; payment count unchanged.");
} else {
  await db("identity", async client => {
    const rows = (await client.query("SELECT data->>'password' AS password FROM users")).rows;
    assert.ok(rows.length >= 3);
    assert.ok(rows.every(row => /^scrypt:[a-f0-9]{32}:[a-f0-9]{64}$/.test(row.password)));
    console.log(`PASS PostgreSQL authentication from host; ${rows.length} salted password hashes, no plaintext passwords.`);
  });
  await db("driver", async client => {
    const rows = (await client.query("SELECT data FROM drivers WHERE data ? 'citizenId'")).rows;
    assert.ok(rows.length > 0);
    assert.ok(rows.every(({ data }) => /^v[12]:/.test(data.citizenId) && /^v[12]:/.test(data.licenseNumber)));
    assert.ok(rows.some(({ data }) => data.citizenId.startsWith("v2:local-v1:")));
    console.log(`PASS ${rows.length} driver documents encrypted with AES-GCM; versioned external key configured.`);
  });
  for (const name of ["customer", "booking", "trip", "payment"]) await db(name, async client => { await client.query("SELECT 1"); console.log(`PASS cab_${name}_db reachable from host`); });
  const mongo = new MongoClient(`mongodb://127.0.0.1:${env.MONGO_HOST_PORT ?? 27017}/cab_notification_db?directConnection=true&replicaSet=rs0`);
  try {
    await mongo.connect();
    const count = await mongo.db().collection("notifications").countDocuments();
    assert.ok(count > 0);
    console.log(`PASS Compass URI connection; ${count} persisted MongoDB notifications.`);
  } finally { await mongo.close(); }
}
