import pg from "pg";
import { MongoClient } from "mongodb";

const owners = {
  "identity-service": ["users", "idempotency"],
  "customer-service": ["customers"],
  "driver-service": ["drivers", "idempotency"],
  "booking-service": ["bookings", "offers", "idempotency"],
  "trip-service": ["trips", "idempotency"],
  "payment-service": ["payments", "idempotency"],
  "notification-service": ["notifications"],
};

// The JSON document remains the compatibility source for the current service
// runtime. These typed columns make the PostgreSQL schema inspectable and keep
// the important business fields queryable without unpacking JSON on every
// query.
const sqlSchemas = {
  users: {
    profile_id: ["text", "profileId"],
    full_name: ["text", "fullName"],
    email: ["text", "email"],
    phone: ["text", "phone"],
    password_hash: ["text", "password"],
    role: ["text", "role"],
    status: ["text", "status"],
    provisioning_phase: ["text", "provisioningPhase"],
    registration_id: ["text", "registrationId"],
    created_at: ["timestamptz", "createdAt"],
    updated_at: ["timestamptz", "updatedAt"],
  },
  customers: {
    user_id: ["text", "userId"],
    full_name: ["text", "fullName"],
    email: ["text", "email"],
    phone: ["text", "phone"],
    created_at: ["timestamptz", "createdAt"],
    updated_at: ["timestamptz", "updatedAt"],
  },
  drivers: {
    user_id: ["text", "userId"],
    full_name: ["text", "fullName"],
    vehicle_type: ["text", "vehicleType"],
    plate: ["text", "plate"],
    citizen_id: ["jsonb", "citizenId"],
    license_number: ["jsonb", "licenseNumber"],
    status: ["text", "status"],
    application_status: ["text", "applicationStatus"],
    latitude: ["double precision", "lat"],
    longitude: ["double precision", "lng"],
    booking_id: ["text", "bookingId"],
    active_trip_id: ["text", "activeTripId"],
    rating_sum: ["double precision", "ratingSum"],
    rating_count: ["integer", "ratingCount"],
    version: ["integer", "version"],
    created_at: ["timestamptz", "createdAt"],
    updated_at: ["timestamptz", "updatedAt"],
  },
  bookings: {
    customer_id: ["text", "customerId"],
    driver_id: ["text", "driverId"],
    trip_id: ["text", "tripId"],
    vehicle_type: ["text", "vehicleType"],
    pickup: ["jsonb", "pickup"],
    destination: ["jsonb", "destination"],
    dropoff: ["jsonb", "dropoff"],
    quoted_fare_vnd: ["bigint", "quotedFareVnd"],
    distance_m: ["integer", "distanceM"],
    status: ["text", "status"],
    requested_at: ["timestamptz", "requestedAt"],
    cancel_reason: ["text", "cancelReason"],
  },
  offers: {
    booking_id: ["text", "bookingId"],
    driver_id: ["text", "driverId"],
    customer_id: ["text", "customerId"],
    reservation_id: ["text", "reservationId"],
    pickup: ["jsonb", "pickup"],
    destination: ["jsonb", "destination"],
    dropoff: ["jsonb", "dropoff"],
    sequence: ["integer", "sequence"],
    status: ["text", "status"],
    expires_at: ["timestamptz", "expiresAt"],
    responded_at: ["timestamptz", "respondedAt"],
  },
  trips: {
    booking_id: ["text", "bookingId"],
    customer_id: ["text", "customerId"],
    driver_id: ["text", "driverId"],
    status: ["text", "status"],
    payment_status: ["text", "paymentStatus"],
    amount_vnd: ["bigint", "amountVnd"],
    vehicle_type: ["text", "vehicleType"],
    pickup: ["jsonb", "pickup"],
    dropoff: ["jsonb", "dropoff"],
    location: ["jsonb", "location"],
    review: ["jsonb", "review"],
    assigned_at: ["timestamptz", "assignedAt"],
    arrived_at: ["timestamptz", "arrivedAt"],
    started_at: ["timestamptz", "startedAt"],
    completed_at: ["timestamptz", "completedAt"],
    canceled_at: ["timestamptz", "canceledAt"],
    canceled_by: ["text", "canceledBy"],
    cancel_reason: ["text", "reason"],
    version: ["integer", "version"],
  },
  payments: {
    booking_id: ["text", "bookingId"],
    trip_id: ["text", "tripId"],
    customer_id: ["text", "customerId"],
    driver_id: ["text", "driverId"],
    amount_vnd: ["bigint", "amountVnd"],
    status: ["text", "status"],
    method: ["text", "method"],
    attempt_count: ["integer", "attemptCount"],
    provider_txn_ref: ["text", "providerTxnRef"],
    payment_url: ["text", "paymentUrl"],
    paid_at: ["timestamptz", "paidAt"],
    refunded_at: ["timestamptz", "refundedAt"],
    released_at: ["timestamptz", "releasedAt"],
    refund_reason: ["text", "refundReason"],
    failed_reason: ["text", "failedReason"],
    created_at: ["timestamptz", "createdAt"],
    updated_at: ["timestamptz", "updatedAt"],
  },
  idempotency: {
    request_hash: ["text", "hash"],
    response_status: ["integer", "status"],
    response_body: ["jsonb", "body"],
    phone: ["text", "phone"],
    expires_at: ["timestamptz", "expiresAt"],
    created_at: ["timestamptz", "createdAt"],
  },
};

const sqlIndexes = {
  users: ["CREATE UNIQUE INDEX IF NOT EXISTS users_email_uq ON users(email) WHERE email IS NOT NULL", "CREATE UNIQUE INDEX IF NOT EXISTS users_phone_uq ON users(phone) WHERE phone IS NOT NULL", "CREATE UNIQUE INDEX IF NOT EXISTS users_profile_id_uq ON users(profile_id) WHERE profile_id IS NOT NULL"],
  customers: ["CREATE UNIQUE INDEX IF NOT EXISTS customers_user_id_uq ON customers(user_id) WHERE user_id IS NOT NULL"],
  drivers: ["CREATE UNIQUE INDEX IF NOT EXISTS drivers_user_id_uq ON drivers(user_id) WHERE user_id IS NOT NULL", "CREATE UNIQUE INDEX IF NOT EXISTS drivers_plate_uq ON drivers(plate) WHERE plate IS NOT NULL", "CREATE INDEX IF NOT EXISTS drivers_status_idx ON drivers(status, vehicle_type)"],
  bookings: [
    "CREATE INDEX IF NOT EXISTS bookings_customer_status_idx ON bookings(customer_id, status)",
    "CREATE UNIQUE INDEX IF NOT EXISTS bookings_trip_id_uq ON bookings(trip_id) WHERE trip_id IS NOT NULL",
    "CREATE UNIQUE INDEX IF NOT EXISTS bookings_one_active_customer_uq ON bookings(customer_id) WHERE status IN ('SEARCHING','ASSIGNED')",
  ],
  offers: ["CREATE INDEX IF NOT EXISTS offers_driver_status_idx ON offers(driver_id, status)", "CREATE INDEX IF NOT EXISTS offers_booking_idx ON offers(booking_id)"],
  trips: ["CREATE UNIQUE INDEX IF NOT EXISTS trips_booking_id_uq ON trips(booking_id) WHERE booking_id IS NOT NULL", "CREATE INDEX IF NOT EXISTS trips_customer_status_idx ON trips(customer_id, status)", "CREATE INDEX IF NOT EXISTS trips_driver_status_idx ON trips(driver_id, status)"],
  payments: ["CREATE UNIQUE INDEX IF NOT EXISTS payments_booking_id_uq ON payments(booking_id) WHERE booking_id IS NOT NULL", "CREATE INDEX IF NOT EXISTS payments_trip_idx ON payments(trip_id)", "CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_ref_uq ON payments(provider_txn_ref) WHERE provider_txn_ref IS NOT NULL"],
};

function databaseValue(value, type) {
  if (value === undefined || value === null) return null;
  if (type === "timestamptz" && typeof value === "number") return new Date(value).toISOString();
  return type === "jsonb" ? JSON.stringify(value) : value;
}

// Each service owns its database. A transaction commits business data and replay
// responses together before HTTP success is sent. The service lock also serializes
// competing requests in separate replicas; no user input becomes SQL syntax.
export function durableStore(service, state) {
  const names = owners[service];
  const mongo = service === "notification-service";
  const client = mongo ? new MongoClient(process.env.MONGO_URI) : new pg.Pool({
    host: process.env.POSTGRES_HOST ?? "postgres", port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? "cab", password: process.env.POSTGRES_PASSWORD,
    database: `cab_${service.replace("-service", "")}_db`,
  });
  let queue = Promise.resolve();
  const expireBookings = async () => {
    if (mongo || service !== "booking-service") return;
    const connection = await client.connect();
    try {
      await connection.query("BEGIN");
      await connection.query("SELECT pg_advisory_xact_lock(742601)");
      // Expiration runs through booking-service so its in-memory and durable
      // representations remain consistent.
      await connection.query(`
        UPDATE offers
        SET status='EXPIRED', data=jsonb_set(data, '{status}', '"EXPIRED"'::jsonb, true)
        WHERE status='PENDING' AND expires_at <= now()
      `);
      await connection.query("COMMIT");
    } catch (error) {
      await connection.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  };
  const ready = (async () => {
    if (mongo) {
      await client.connect();
      for (const name of [...names, "runtime_metadata"]) {
        if (!(await client.db().listCollections({ name }).toArray()).length) await client.db().createCollection(name);
      }
      return;
    }
    for (const name of names) {
      await client.query(`CREATE TABLE IF NOT EXISTS "${name}" (id text PRIMARY KEY, data jsonb NOT NULL)`);
      for (const [column, [type]] of Object.entries(sqlSchemas[name] ?? {}))
        await client.query(`ALTER TABLE "${name}" ADD COLUMN IF NOT EXISTS "${column}" ${type}`);
    }
    if (service === "customer-service") {
      await client.query("UPDATE customers SET data = data - 'balanceVnd' - 'walletTransactionIds'");
      await client.query("ALTER TABLE customers DROP COLUMN IF EXISTS balance_vnd");
    }
    if (service === "driver-service") {
      await client.query("UPDATE drivers SET data = data - 'balanceVnd' - 'walletTransactionIds'");
      await client.query("ALTER TABLE drivers DROP COLUMN IF EXISTS balance_vnd");
    }
    if (service === "booking-service") {
      await expireBookings();
      await client.query(`
        WITH duplicates AS (
          SELECT id, status, row_number() OVER (
            PARTITION BY customer_id
            ORDER BY (status='ASSIGNED') DESC, requested_at DESC NULLS LAST, id
          ) AS position
          FROM bookings
          WHERE status IN ('SEARCHING','ASSIGNED') AND customer_id IS NOT NULL
        )
        UPDATE bookings AS booking
        SET status=CASE WHEN booking.status='SEARCHING' THEN 'EXPIRED' ELSE 'CANCELED' END,
            data=jsonb_set(
              booking.data,
              '{status}',
              to_jsonb(CASE WHEN booking.status='SEARCHING' THEN 'EXPIRED' ELSE 'CANCELED' END::text),
              true
            )
        FROM duplicates
        WHERE booking.id=duplicates.id AND duplicates.position > 1
      `);
    }
    for (const name of names)
      for (const statement of sqlIndexes[name] ?? []) await client.query(statement);
    await client.query("CREATE TABLE IF NOT EXISTS runtime_metadata (id text PRIMARY KEY)");
  })();
  if (service === "booking-service") {
    ready.then(() => {
      const timer = setInterval(() => void expireBookings().catch(() => {}), 30_000);
      timer.unref();
    });
  }
  return {
    ready,
    async ping() { await ready; return mongo ? client.db().command({ ping: 1 }) : client.query("SELECT 1"); },
    middleware(req, res, next) {
      const run = async () => {
        await ready;
        const connection = mongo ? null : await client.connect();
        const session = mongo ? client.startSession() : null;
        const original = res.end;
        let finish;
        const completed = new Promise(resolve => { finish = resolve; });
        try {
          if (mongo) session.startTransaction();
          else { await connection.query("BEGIN"); await connection.query("SELECT pg_advisory_xact_lock(742601)"); }
          const initialized = mongo
            ? await client.db().collection("runtime_metadata").findOne({ _id: "seeded" }, { session })
            : (await connection.query("SELECT id FROM runtime_metadata WHERE id='seeded'")).rows[0];
          if (initialized) for (const name of names) {
            const rows = mongo ? await client.db().collection(name).find({}, { session }).toArray()
              : (await connection.query(`SELECT id, data FROM "${name}"`)).rows;
            state[name].clear();
            for (const row of rows) state[name].set(row.id, row.data);
          }
          const before = Object.fromEntries(names.map(name => [name, new Map([...state[name]].map(([id, data]) => [id, JSON.stringify(data)]))]));
          const restore = () => { for (const name of names) { state[name].clear(); for (const [id, data] of before[name]) state[name].set(id, JSON.parse(data)); } };
          res.end = function (...args) {
            res.end = original;
            (async () => {
              if (res.statusCode < 400) {
                for (const name of names) {
                  for (const [id, data] of state[name]) {
                    if (initialized && before[name].get(id) === JSON.stringify(data)) continue;
                    if (mongo) await client.db().collection(name).updateOne({ id }, { $set: { data } }, { upsert: true, session });
                    else {
                      const schema = sqlSchemas[name] ?? {};
                      const columns = Object.keys(schema);
                      const quotedColumns = columns.map(column => `"${column}"`);
                      const values = columns.map(column => databaseValue(data[schema[column][1]], schema[column][0]));
                      const parameters = [id, JSON.stringify(data), ...values];
                      const placeholders = parameters.map((_, index) => `$${index + 1}`);
                      const updates = ["data=EXCLUDED.data", ...quotedColumns.map(column => `${column}=EXCLUDED.${column}`)];
                      await connection.query(
                        `INSERT INTO "${name}" (id,data${quotedColumns.length ? `,${quotedColumns.join(",")}` : ""}) VALUES (${placeholders.join(",")}) ON CONFLICT (id) DO UPDATE SET ${updates.join(",")}`,
                        parameters,
                      );
                    }
                  }
                  for (const id of before[name].keys()) if (!state[name].has(id)) {
                    if (mongo) await client.db().collection(name).deleteOne({ id }, { session });
                    else await connection.query(`DELETE FROM "${name}" WHERE id=$1`, [id]);
                  }
                }
                if (mongo) { await client.db().collection("runtime_metadata").updateOne({ _id: "seeded" }, { $set: { initialized: true } }, { upsert: true, session }); await session.commitTransaction(); }
                else { await connection.query("INSERT INTO runtime_metadata VALUES ('seeded') ON CONFLICT DO NOTHING"); await connection.query("COMMIT"); }
              } else { restore(); if (mongo) await session.abortTransaction(); else await connection.query("ROLLBACK"); }
              original.apply(res, args);
            })().catch(async () => {
              restore();
              if (mongo) { if (session.inTransaction()) await session.abortTransaction().catch(() => {}); }
              else await connection.query("ROLLBACK").catch(() => {});
              res.statusCode = 503; res.removeHeader("Content-Length"); original.call(res, JSON.stringify({ error: { code: "STORAGE_UNAVAILABLE" } }));
            })
              .finally(() => { connection?.release(); session?.endSession(); finish(); });
            return res;
          };
          next();
          await completed;
        } catch (err) {
          if (connection) { await connection.query("ROLLBACK").catch(() => {}); connection.release(); }
          await session?.endSession();
          next(err);
        }
      };
      queue = queue.then(run, run);
    },
  };
}
