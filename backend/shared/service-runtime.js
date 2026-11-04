import express from "express";
import { durableStore } from "./persistence.js";
import net from "node:net";
import crypto from "node:crypto";
import fs from "node:fs";
import { signJwt, verifyJwt } from "./jwt.js";
import { publishNotificationEvent } from "./kafka.js";

const state = {
  users: new Map(),
  customers: new Map(),
  drivers: new Map(),
  bookings: new Map(),
  offers: new Map(),
  trips: new Map(),
  payments: new Map(),
  idempotency: new Map(),
  notifications: new Map(),
};
const INTERNAL_TOKEN =
  process.env.INTERNAL_SERVICE_TOKEN ?? "local-internal-token";
const DEMO_CUSTOMER = "10000000-0000-4000-8000-000000000001";
const DEMO_DRIVER = "20000000-0000-4000-8000-000000000001";
const DEMO_ADMIN = "30000000-0000-4000-8000-000000000001";
function hashPassword(value) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `scrypt:${salt}:${crypto.scryptSync(String(value), salt, 32).toString("hex")}`;
}
function passwordMatches(value, stored) {
  if (typeof value !== "string" || typeof stored !== "string") return false;
  const [scheme, salt, hash] = stored.split(":");
  const expected = scheme === "scrypt" ? hash : stored;
  const actual = crypto.scryptSync(value, scheme === "scrypt" ? salt : "cab-password-salt", 32).toString("hex");
  return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
async function internalCall(service, path, body) {
  const ports = { identity: 3000, customer: 3001, driver: 3002, booking: 3003, trip: 3004, payment: 3005, notification: 3006 };
  const response = await fetch(`http://${service}-service:${ports[service]}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Service-Token": INTERNAL_TOKEN },
    body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`upstream ${service}: ${response.status}`);
  return response.json();
}
async function notify(recipientId, type, resourceId) {
  const event = { recipientId, type, resourceId };
  try {
    await publishNotificationEvent(event);
  } catch (error) {
    console.error(`Kafka notification publish failed for ${type}:`, error.message);
  }
  return internalCall("notification", "/internal/notifications", event);
}
function replayKey(request, prefix) {
  return `${prefix}:${request.user?.sub ?? parseToken(request.get("Authorization"))?.sub ?? "anonymous"}:${request.path}:${request.get("Idempotency-Key")}`;
}
function validPoint(point) {
  return point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng)) && Math.abs(Number(point.lat)) <= 90 && Math.abs(Number(point.lng)) <= 180;
}
function encryptField(value) {
  const key = crypto
    .createHash("sha256")
    .update(process.env.FIELD_ENCRYPTION_KEY_PATH ? fs.readFileSync(process.env.FIELD_ENCRYPTION_KEY_PATH) : process.env.FIELD_ENCRYPTION_KEY ?? "cab-local-field-key")
    .digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(value ?? ""), "utf8"),
    cipher.final(),
  ]);
  return `v2:${process.env.FIELD_ENCRYPTION_ACTIVE_KID ?? "local-v1"}:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}
function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>\"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
}
function tokenFor(user) {
  return signJwt({
    sub: user.id,
    profileId: user.profileId,
    role: user.role,
    accountStatus: user.status,
    scope: ["*"],
    iss: "identity-service",
    aud: "cab-gateway",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
}
function parseToken(value) {
  return verifyJwt(value);
}
function error(response, status, code, message) {
  return response
    .status(status)
    .json({
      error: { code, message },
      requestId: response.getHeader("X-Request-ID"),
    });
}
function bodyHash(request) {
  return request.replayBodyHash ??= crypto
    .createHash("sha256")
    .update(JSON.stringify(request.body ?? {}))
    .digest("hex");
}
function requireUser(request, response, roles = []) {
  const user = parseToken(request.get("Authorization"));
  if (!user) {
    error(response, 401, "UNAUTHORIZED", "valid access token required");
    return null;
  }
  if (roles.length && !roles.includes(user.role)) {
    error(response, 403, "FORBIDDEN", "insufficient role");
    return null;
  }
  request.user = user;
  return user;
}
function requireInternal(request, response) {
  if (request.get("X-Service-Token") !== INTERNAL_TOKEN) {
    error(response, 401, "UNAUTHORIZED", "internal credential required");
    return false;
  }
  return true;
}
function idempotent(request, response, prefix) {
  bodyHash(request);
  const id = request.get("Idempotency-Key");
  if (!id) {
    error(
      response,
      400,
      "MISSING_IDEMPOTENCY_KEY",
      "Idempotency-Key is required",
    );
    return false;
  }
  const key = replayKey(request, prefix),
    record = state.idempotency.get(key);
  if (record && record.hash !== bodyHash(request)) {
    error(
      response,
      422,
      "IDEMPOTENCY_BODY_MISMATCH",
      "same key was used with a different request",
    );
    return false;
  }
  if (record) {
    response.status(record.status).json(record.body);
    return false;
  }
  return true;
}
function saveIdempotency(request, prefix, status, body) {
  const id = request.get("Idempotency-Key");
  if (id)
    state.idempotency.set(replayKey(request, prefix), {
      hash: bodyHash(request),
      status,
      body,
    });
}
function seed() {
  if (process.env.SEED_DEMO_DATA === "false" || state.users.size) return;
  for (let i = 1; i <= 5; i++) {
    const id = `demo-booking-${i}`;
    state.bookings.set(id, { id, customerId: DEMO_CUSTOMER, status: "COMPLETED", vehicleType: "BIKE", requestedAt: new Date().toISOString() });
  }
  state.users.set(DEMO_CUSTOMER, {
    id: DEMO_CUSTOMER,
    profileId: DEMO_CUSTOMER,
    role: "CUSTOMER",
    status: "ACTIVE",
    email: "customer@cab.local",
    phone: "+84901111111",
    password: hashPassword("Customer123!"),
  });
  state.users.set(DEMO_DRIVER, {
    id: DEMO_DRIVER,
    profileId: DEMO_DRIVER,
    role: "DRIVER",
    status: "ACTIVE",
    email: "driver@cab.local",
    phone: "+84902222222",
    password: hashPassword("Driver123!"),
  });
  state.users.set(DEMO_ADMIN, {
    id: DEMO_ADMIN,
    profileId: DEMO_ADMIN,
    role: "ADMIN",
    status: "ACTIVE",
    email: "admin@cab.local",
    phone: "+84903333333",
    password: hashPassword("Admin123!"),
  });
  state.customers.set(DEMO_CUSTOMER, {
    id: DEMO_CUSTOMER,
    userId: DEMO_CUSTOMER,
    fullName: "Demo Customer",
    email: "customer@cab.local",
    phone: "+84901111111",
    createdAt: new Date().toISOString(),
  });
  for (let index = 1; index <= 5; index += 1) {
    const id = `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    state.drivers.set(id, {
      id,
      userId: id,
      fullName: `Demo Driver ${index}`,
      vehicleType: index % 2 ? "BIKE" : "SEDAN",
      plate: `59A${index}-12345`,
      status: index <= 3 ? "ONLINE" : "OFFLINE",
      lat: 10.773 + index * 0.001,
      lng: 106.699 + index * 0.001,
      applicationStatus: "APPROVED",
    });
  }
}
function distanceM(a, b) {
  const radians = Math.PI / 180,
    dLat = (a.lat - b.lat) * radians,
    dLng = (a.lng - b.lng) * radians,
    x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(a.lat * radians) *
        Math.cos(b.lat * radians) *
        Math.sin(dLng / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

// PC19 tariff: every started 100 m costs 900 VND.
function calculateFareVnd(distanceInMeters) {
  const meters = Number(distanceInMeters);
  if (!Number.isFinite(meters) || meters <= 0) return 0;
  return Math.ceil(meters / 100) * 900;
}

function configuration() {
  return {
    dependencyList: (process.env.DEPENDENCIES ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    token: process.env.INTERNAL_SERVICE_TOKEN ?? "local-internal-token",
    serviceName: process.env.SERVICE_NAME ?? "service",
    port: Number(process.env.SERVICE_PORT ?? 3000),
    storageMode: process.env.STORAGE_MODE ?? "memory",
  };
}

function persistenceState() {
  const { storageMode } = configuration();
  if (storageMode === "memory")
    return {
      mode: "memory",
      durable: false,
      fallback: "local-only in-memory state",
    };
  return {
    mode: storageMode,
    durable: false,
    ready: false,
    error: "no durable adapter is configured for this runtime",
  };
}

function checkTcp(address) {
  const [host, portText] = address.split(":");
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port: Number(portText) });
    const finish = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(1500);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function dependencyState() {
  const { dependencyList } = configuration();
  const results = await Promise.all(
    dependencyList.map(async (address) => ({
      address,
      status: (await checkTcp(address)) ? "up" : "down",
    })),
  );
  return {
    ready: results.every((item) => item.status === "up"),
    dependencies: results,
  };
}

const routeContext = {
  state, INTERNAL_TOKEN, crypto, hashPassword, passwordMatches, internalCall, notify,
  validPoint, encryptField, escapeHtml, tokenFor, parseToken, error, requireUser,
  requireInternal, idempotent, saveIdempotency, distanceM, calculateFareVnd,
};

export { calculateFareVnd };

export function createService({ endpoints = [], registerRoutes } = {}) {
  const { token, serviceName } = configuration();
  const store = configuration().storageMode === "database" ? durableStore(serviceName, state) : null;
  const persistence = store ? { mode: "database", durable: true, ready: true } : persistenceState();
  seed();
  const app = express();
  app.use(
    "/payments/callback",
    express.raw({ type: "application/json", limit: "1mb" }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.get("/health", (_request, response) =>
    response.json({ status: "healthy", service: serviceName, persistence }),
  );
  app.get("/", (_request, response) =>
    response.json({
      service: serviceName,
      status: "running",
      endpointCatalog: "/endpoints",
      publicBaseUrl: "http://localhost:8000/api/v1",
    }),
  );
  app.get("/endpoints", (_request, response) =>
    response.json({
      service: serviceName,
      publicBaseUrl: "http://localhost:8000/api/v1",
      note: "Public endpoints are tested through the Gateway. Internal endpoints require X-Service-Token inside cab-internal.",
      endpoints: endpoints.map((endpoint) => ({
        ...endpoint,
        testUrl:
          endpoint.access === "public"
            ? `http://localhost:8000/api/v1${endpoint.path}`
            : `http://${serviceName}:${configuration().port}${endpoint.path}`,
        requiredHeaders: [
          ...(endpoint.access === "internal" ? ["X-Service-Token"] : []),
          ...(endpoint.roles?.some((role) => !["PUBLIC", "PAYMENT_PROVIDER(HMAC)"].includes(role))
            ? ["Authorization: Bearer <accessToken>"]
            : []),
          ...(endpoint.idempotent ? ["Idempotency-Key"] : []),
          ...(endpoint.roles?.includes("PAYMENT_PROVIDER(HMAC)")
            ? ["X-Timestamp", "X-Signature"]
            : []),
        ],
      })),
    }),
  );
  app.get("/ready", async (request, response) => {
    if (request.get("X-Service-Token") !== token)
      return response.status(401).json({ error: "unauthorized" });
    const state = await dependencyState();
    if (store) try { await store.ping(); } catch { state.ready = false; }
    const ready =
      state.ready && (persistence.mode === "memory" || persistence.ready);
    return response.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "not_ready",
      service: serviceName,
      persistence,
      ...state,
    });
  });
  app.use((request, response, next) => {
    response.set(
      "X-Request-ID",
      request.get("X-Request-ID") ?? crypto.randomUUID(),
    );
    next();
  });
  // Capture rejected promises in Express 4 and commit before sending a response.
  for (const method of ["get", "post", "put", "patch", "delete"]) {
    const original = app[method].bind(app);
    app[method] = (path, ...handlers) => original(path, ...handlers.map(handler =>
      (req, res, next) => { try { Promise.resolve(handler(req, res, next)).catch(next); } catch (err) { next(err); } }));
  }
  app.use((req, res, next) => {
    if (!requireInternal(req, res)) return;
    if (req.path.startsWith("/internal/")) {
      const resource = req.path.split("/")[2];
      const owner = req.path.endsWith("/active-trip")
        ? "trip"
        : { accounts: "identity", customers: "customer", drivers: "driver", bookings: "booking", trips: "trip", payments: "payment", notifications: "notification" }[resource];
      if (serviceName !== `${owner}-service`) return error(res, 404, "NOT_FOUND", "route not found");
    }
    for (const name of ["page", "limit", "radius"]) if (req.query[name] !== undefined && (!Number.isInteger(Number(req.query[name])) || Number(req.query[name]) <= 0)) return error(res, 400, "INVALID_ARGUMENT", `invalid ${name}`);
    if (req.path.includes("nearby") && !validPoint(req.query)) return error(res, 400, "INVALID_ARGUMENT", "invalid coordinates");
    for (const point of [req.body?.pickup, req.body?.destination, req.body?.dropoff, req.body?.pick, req.body?.des]) if (point && !validPoint(point)) return error(res, 400, "INVALID_ARGUMENT", "invalid coordinates");
    next();
  });
  if (store) app.use(store.middleware);
  registerRoutes?.(app, routeContext);
  app.use((_request, response) =>
    response
      .status(404)
      .json({ error: "route not implemented", service: serviceName }),
  );
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    return error(res, err.type === "entity.parse.failed" ? 400 : 503, "REQUEST_FAILED", "request could not be completed");
  });
  return app;
}

export function startService() {
  const { port, serviceName } = configuration();
  createService().listen(port, "0.0.0.0", () =>
    console.log(`${serviceName} listening on ${port}`),
  );
}
