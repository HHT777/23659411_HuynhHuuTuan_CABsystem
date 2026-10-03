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
  const ready = (async () => {
    if (mongo) {
      await client.connect();
      for (const name of [...names, "runtime_metadata"]) {
        if (!(await client.db().listCollections({ name }).toArray()).length) await client.db().createCollection(name);
      }
      return;
    }
    for (const name of names) await client.query(`CREATE TABLE IF NOT EXISTS "${name}" (id text PRIMARY KEY, data jsonb NOT NULL)`);
    await client.query("CREATE TABLE IF NOT EXISTS runtime_metadata (id text PRIMARY KEY)");
  })();
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
                    else await connection.query(`INSERT INTO "${name}" (id,data) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data`, [id, JSON.stringify(data)]);
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
