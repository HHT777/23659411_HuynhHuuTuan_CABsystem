import express from "express";
import { durableStore } from "./persistence.js";
import net from "node:net";
import crypto from "node:crypto";
import fs from "node:fs";
import { signJwt, verifyJwt } from "./jwt.js";

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
  return internalCall("notification", "/internal/notifications", { recipientId, type, resourceId });
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

export function createService({ endpoints = [] } = {}) {
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
      publicBaseUrl: "http://localhost:8000",
    }),
  );
  app.get("/endpoints", (_request, response) =>
    response.json({
      service: serviceName,
      publicBaseUrl: "http://localhost:8000",
      note: "Public endpoints are tested through the Gateway. Internal endpoints require X-Service-Token inside cab-internal.",
      endpoints: endpoints.map((endpoint) => ({
        ...endpoint,
        testUrl:
          endpoint.access === "public"
            ? `http://localhost:8000${endpoint.path}`
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
      const owner = { accounts: "identity", customers: "customer", drivers: "driver", bookings: "booking", trips: "trip", notifications: "notification" }[resource];
      if (serviceName !== `${owner}-service`) return error(res, 404, "NOT_FOUND", "route not found");
    }
    for (const name of ["page", "limit", "radius"]) if (req.query[name] !== undefined && (!Number.isInteger(Number(req.query[name])) || Number(req.query[name]) <= 0)) return error(res, 400, "INVALID_ARGUMENT", `invalid ${name}`);
    if (req.path.includes("nearby") && !validPoint(req.query)) return error(res, 400, "INVALID_ARGUMENT", "invalid coordinates");
    for (const point of [req.body?.pickup, req.body?.dropoff]) if (point && !validPoint(point)) return error(res, 400, "INVALID_ARGUMENT", "invalid coordinates");
    next();
  });
  if (store) app.use(store.middleware);
  app.post("/internal/notifications", (req, res) => {
    const id = `${req.body.recipientId}:${req.body.type}:${req.body.resourceId}`;
    const item = state.notifications.get(id) ?? { id, ...req.body, createdAt: new Date().toISOString(), readAt: null };
    state.notifications.set(id, item);
    return res.status(201).json(item);
  });
  app.post("/internal/accounts/:id/status", (req, res) => {
    const user = state.users.get(req.params.id);
    if (!user) return error(res, 404, "NOT_FOUND", "account not found");
    user.status = req.body.status;
    return res.json({ status: user.status });
  });
  app.post("/internal/bookings/:id/status", (req, res) => {
    const booking = state.bookings.get(req.params.id);
    if (!booking) return error(res, 404, "NOT_FOUND", "booking not found");
    booking.status = req.body.status;
    return res.json(booking);
  });
  app.post("/internal/drivers/:id/status", (req, res) => {
    const driver = state.drivers.get(req.params.id);
    if (!driver) return error(res, 404, "NOT_FOUND", "driver not found");
    if (req.body.status === "BUSY" && driver.status !== "ONLINE" && driver.bookingId !== req.body.bookingId) return error(res, 409, "DRIVER_BUSY", "driver unavailable");
    if (req.body.status === "ONLINE" && driver.bookingId && driver.bookingId !== req.body.bookingId) return error(res, 409, "DRIVER_BUSY", "another booking owns driver reservation");
    driver.status = req.body.status;
    driver.bookingId = req.body.bookingId ?? null;
    return res.json({ status: driver.status });
  });
  app.use("/internal", (request, response, next) =>
    requireInternal(request, response) ? next() : undefined,
  );
  app.post("/internal/customers", (request, response) => {
    const { userId, fullName, email, phone } = request.body;
    const customer = state.customers.get(userId) ?? {
      id: userId,
      userId,
      fullName: escapeHtml(fullName),
      email,
      phone,
      createdAt: new Date().toISOString(),
    };
    state.customers.set(userId, customer);
    return response.status(201).json({ customerId: customer.id });
  });
  app.post("/internal/accounts/drivers", (request, response) => {
    const { driverId, password, email, phone } = request.body;
    if (!driverId || !password)
      return error(
        response,
        400,
        "INVALID_ARGUMENT",
        "driverId and password are required",
      );
    state.users.set(driverId, {
      id: driverId,
      profileId: driverId,
      role: "DRIVER",
      status: "PENDING_APPROVAL",
      email, phone,
      password: hashPassword(password),
    });
    return response.status(201).json({ accountId: driverId });
  });
  app.get("/internal/trips/:id/payable", (request, response) => {
    const trip = state.trips.get(request.params.id);
    if (!trip) return error(response, 404, "NOT_FOUND", "trip not found");
    return response.json({
      customerId: trip.customerId,
      status: trip.status,
      fare: {
        amountVnd: trip.amountVnd,
        currency: "VND",
        tariffVersion: "demo-v1",
      },
      paymentStatus: trip.paymentStatus,
    });
  });
  app.post("/internal/trips/:id/paid", (request, response) => {
    const trip = state.trips.get(request.params.id);
    if (!trip) return error(response, 404, "NOT_FOUND", "trip not found");
    trip.paymentStatus = "PAID";
    return response.json({
      tripId: trip.id,
      paymentStatus: trip.paymentStatus,
    });
  });
  app.get("/internal/customers/:id/active-trip", (request, response) => {
    const trip = [...state.trips.values()].find(
      (item) =>
        item.customerId === request.params.id &&
        ["ASSIGNED", "ARRIVED", "IN_PROGRESS"].includes(item.status),
    );
    return trip
      ? response.json({ tripId: trip.id, status: trip.status })
      : error(response, 404, "NOT_FOUND", "no active trip");
  });
  app.get("/internal/drivers/nearby", (request, response) => {
    const point = {
        lat: Number(request.query.lat),
        lng: Number(request.query.lng),
      },
      radius = Number(request.query.radius ?? 5000);
    return response.json(
      [...state.drivers.values()]
        .filter(
          (driver) =>
            driver.status === "ONLINE" &&
            (!request.query.vehicleType ||
              driver.vehicleType === request.query.vehicleType) &&
            distanceM(point, driver) <= radius,
        )
        .sort((a, b) => distanceM(point, a) - distanceM(point, b))
        .map((driver) => ({
          driverId: driver.id,
          vehicleType: driver.vehicleType,
          distanceM: distanceM(point, driver),
          lat: driver.lat,
          lng: driver.lng,
        })),
    );
  });
  app.post("/internal/trips", (request, response) => {
    const data = request.body;
    let trip = [...state.trips.values()].find(
      (item) => item.bookingId === data.bookingId,
    );
    if (!trip) {
      trip = {
        id: crypto.randomUUID(),
        bookingId: data.bookingId,
        customerId: data.customerId,
        driverId: data.driverId,
        status: "ASSIGNED",
        amountVnd: 25000,
        paymentStatus: "UNPAID",
        pickup: data.pickup,
        dropoff: data.dropoff,
        vehicleType: data.vehicleType,
      };
      state.trips.set(trip.id, trip);
    }
    return response
      .status(201)
      .json({
        tripId: trip.id,
        bookingId: trip.bookingId,
        driverId: trip.driverId,
        status: trip.status,
      });
  });
  if (serviceName === "identity-service") {
    app.post("/auth/register", async (request, response) => {
      if (!idempotent(request, response, "register")) return;
      const { fullName, email, phone, password } = request.body;
      if (!fullName || !email || !phone || !password || password.length < 6)
        return error(
          response,
          400,
          "INVALID_ARGUMENT",
          "fullName, email, phone and password are required",
        );
      if (
        [...state.users.values()].some(
          (user) => user.email === email || user.phone === phone,
        )
      )
        return error(response, 409, "ALREADY_EXISTS", "account already exists");
      const id = crypto.randomUUID();
      state.users.set(id, {
        id,
        profileId: id,
        role: "CUSTOMER",
        status: "ACTIVE",
        email,
        phone,
        password: hashPassword(password),
      });
      const profile = await fetch(
        "http://customer-service:3001/internal/customers",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Service-Token": INTERNAL_TOKEN,
          },
          body: JSON.stringify({ userId: id, fullName, email, phone }),
        },
      )
        .then((result) => result.json())
        .catch(() => null);
      if (!profile?.customerId)
        return error(
          response,
          503,
          "SERVICE_UNAVAILABLE",
          "customer profile is not ready",
        );
      const result = { customerId: profile.customerId, userId: id };
      saveIdempotency(request, "register", 201, result);
      return response.status(201).json(result);
    });
    app.post("/auth/login", (request, response) => {
      const { email, phone, password } = request.body;
      const user = [...state.users.values()].find(
        (candidate) =>
          (email && candidate.email === email) ||
          (phone && candidate.phone === phone),
      );
      if (!user || !passwordMatches(password, user.password))
        return error(response, 401, "UNAUTHORIZED", "invalid credentials");
      if (["REJECTED", "DISABLED", "SUSPENDED"].includes(user.status)) return error(response, 403, "FORBIDDEN", "account inactive");
      return response.json({
        accessToken: tokenFor(user),
        tokenType: "Bearer",
        expiresIn: 3600,
        role: user.role,
        accountStatus: user.status,
        scope: ["*"],
      });
    });
  }
  if (serviceName === "customer-service")
    app.get("/customers/:id", (request, response) => {
      const user = requireUser(request, response, ["CUSTOMER", "ADMIN"]);
      if (!user) return;
      if (user.role === "CUSTOMER" && user.profileId !== request.params.id)
        return error(response, 403, "FORBIDDEN", "resource ownership required");
      const customer = state.customers.get(request.params.id);
      return customer
        ? response.json({
            ...customer,
            fullName: customer.fullName,
          })
        : error(response, 404, "NOT_FOUND", "customer not found");
    });
  if (serviceName === "driver-service") {
    app.get("/drivers/:id", (request, response, next) => {
      if (request.params.id === "nearby") return next();
      const user = requireUser(request, response, [
        "CUSTOMER",
        "DRIVER",
        "ADMIN",
      ]);
      if (!user) return;
      const driver = state.drivers.get(request.params.id);
      if (!driver) return error(response, 404, "NOT_FOUND", "driver not found");
      if (user.role === "DRIVER" && user.profileId !== driver.id)
        return error(response, 403, "FORBIDDEN", "resource ownership required");
      return response.json(
        user.role === "DRIVER" || user.role === "ADMIN"
          ? {
              ...driver,
              citizenId: "***masked***",
              licenseNumber: "***masked***",
            }
          : {
              id: driver.id,
              fullName: escapeHtml(driver.fullName),
              vehicleType: driver.vehicleType,
              plate: driver.plate,
              status: driver.status,
            },
      );
    });
    app.post("/drivers/otp/request", (request, response) => {
      if (!request.body.phone)
        return error(response, 400, "INVALID_ARGUMENT", "phone is required");
      const challengeId = crypto.randomUUID();
      state.idempotency.set(`otp:${request.body.phone}`, {
        challengeId,
        code: process.env.OTP_MOCK_CODE ?? "123456", expiresAt: Date.now() + 300000,
      });
      return response
        .status(202)
        .json({
          challengeId,
          expiresAt: new Date(Date.now() + 300000).toISOString(),
        });
    });
    app.post("/drivers/otp/verify", (request, response) => {
      const record = state.idempotency.get(`otp:${request.body.phone}`);
      if (
        !record ||
        record.challengeId !== request.body.challengeId ||
        record.used || record.expiresAt < Date.now() || request.body.code !== record.code
      )
        return error(response, 422, "INVALID_OTP", "OTP is invalid or expired");
      record.used = true;
      const driverId = crypto.randomUUID();
      state.idempotency.set(`registration:${driverId}`, { phone: request.body.phone, expiresAt: Date.now() + 900000 });
      return response.json({
        registrationToken: tokenFor({
          id: driverId,
          profileId: driverId,
          role: "DRIVER",
          status: "PENDING_APPROVAL",
        }),
        challengeId: record.challengeId,
        driverId,
      });
    });
    app.post("/drivers/register", async (request, response) => {
      if (!idempotent(request, response, "driver-register")) return;
      const registration = parseToken(request.get("Authorization")),
        driverId =
          registration?.profileId ??
          request.body.driverId ??
          crypto.randomUUID();
      const proof = state.idempotency.get(`registration:${driverId}`);
      if (!registration || registration.role !== "DRIVER" || !proof || proof.phone !== request.body.phone || proof.expiresAt < Date.now()) return error(response, 401, "UNAUTHORIZED", "verified phone registration required");
      if (state.drivers.has(driverId)) return error(response, 409, "ALREADY_EXISTS", "driver already registered");
      if (!request.body.fullName || !request.body.email || !request.body.password || request.body.password.length < 6 || !request.body.plate || !request.body.citizenId || !request.body.licenseNumber) return error(response, 400, "INVALID_ARGUMENT", "personal, vehicle and password fields required");
      const driver = {
        id: driverId,
        userId: driverId,
        fullName: escapeHtml(request.body.fullName),
        vehicleType: request.body.vehicleType ?? "BIKE",
        plate: request.body.plate,
        citizenId: encryptField(request.body.citizenId),
        licenseNumber: encryptField(request.body.licenseNumber),
        status: "PENDING_APPROVAL",
        applicationStatus: "PENDING_APPROVAL",
        lat: 10.7735,
        lng: 106.699,
      };
      state.drivers.set(driverId, driver);
      state.users.set(driverId, {
        id: driverId,
        profileId: driverId,
        role: "DRIVER",
        status: "PENDING_APPROVAL",
        phone: request.body.phone,
        password: hashPassword(request.body.password ?? "Driver123!"),
      });
      await fetch("http://identity-service:3000/internal/accounts/drivers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Token": INTERNAL_TOKEN,
        },
        body: JSON.stringify({
          driverId,
          password: request.body.password ?? "Driver123!",
          email: request.body.email, phone: request.body.phone,
        }),
      });
      const result = {
        driverId,
        applicationId: driverId,
        status: "PENDING_APPROVAL",
      };
      saveIdempotency(request, "driver-register", 201, result);
      return response.status(201).json(result);
    });
    app.get("/drivers/me/application", (request, response) => {
      const user = requireUser(request, response, ["DRIVER"]);
      if (!user) return;
      const driver = state.drivers.get(user.profileId);
      return driver
        ? response.json({
            driverId: driver.id,
            status: driver.applicationStatus,
            vehicleType: driver.vehicleType,
          })
        : error(response, 404, "NOT_FOUND", "application not found");
    });
    app.get("/admin/drivers", (request, response) => {
      if (!requireUser(request, response, ["ADMIN"])) return;
      const items = [...state.drivers.values()].filter(
        (driver) =>
          !request.query.status ||
          driver.applicationStatus === request.query.status ||
          driver.status === request.query.status,
      );
      const page = Number(request.query.page ?? 1),
        limit = Math.min(Number(request.query.limit ?? 20), 100);
      return response.json({
        items: items.slice((page - 1) * limit, page * limit),
        page,
        limit,
        total: items.length,
      });
    });
    app.get("/admin/drivers/:id", (request, response) => {
      if (!requireUser(request, response, ["ADMIN"])) return;
      const driver = state.drivers.get(request.params.id);
      return driver
        ? response.json({
            ...driver,
            citizenId: "***masked***",
            licenseNumber: "***masked***",
          })
        : error(response, 404, "NOT_FOUND", "driver not found");
    });
    app.post("/admin/drivers/:id/approve", async (request, response) => {
      if (!requireUser(request, response, ["ADMIN"])) return;
      const driver = state.drivers.get(request.params.id);
      if (!driver) return error(response, 404, "NOT_FOUND", "driver not found");
      if (driver.applicationStatus === "APPROVED") return response.json({ driverId: driver.id, status: driver.status, decision: "APPROVE" });
      if (driver.applicationStatus !== "PENDING_APPROVAL") return error(response, 409, "INVALID_STATE", "application is not pending");
      await internalCall("identity", `/internal/accounts/${driver.id}/status`, { status: "ACTIVE" });
      await notify(driver.id, "DRIVER_APPROVED", driver.id);
      driver.applicationStatus = "APPROVED";
      driver.status = "OFFLINE";
      const account = state.users.get(driver.id);
      if (account) account.status = "ACTIVE";
      return response.json({
        driverId: driver.id,
        status: "OFFLINE",
        decision: "APPROVE",
      });
    });
    app.post("/admin/drivers/:id/reject", async (request, response) => {
      if (!requireUser(request, response, ["ADMIN"])) return;
      if (!request.body.reason)
        return error(response, 400, "INVALID_ARGUMENT", "reason is required");
      const driver = state.drivers.get(request.params.id);
      if (!driver) return error(response, 404, "NOT_FOUND", "driver not found");
      if (driver.applicationStatus !== "PENDING_APPROVAL") return error(response, 409, "INVALID_STATE", "application is not pending");
      await internalCall("identity", `/internal/accounts/${driver.id}/status`, { status: "REJECTED" });
      await notify(driver.id, "DRIVER_REJECTED", driver.id);
      driver.applicationStatus = "REJECTED";
      driver.status = "REJECTED";
      return response.json({
        driverId: driver.id,
        status: "REJECTED",
        decision: "REJECT",
        reason: escapeHtml(request.body.reason),
      });
    });
    app.put("/drivers/me/availability", (request, response) => {
      const user = requireUser(request, response, ["DRIVER"]);
      if (!user) return;
      const driver = state.drivers.get(user.profileId);
      if (!driver || driver.applicationStatus !== "APPROVED")
        return error(response, 403, "FORBIDDEN", "driver is not approved");
      if (!["ONLINE", "OFFLINE"].includes(request.body.status))
        return error(
          response,
          400,
          "INVALID_ARGUMENT",
          "status must be ONLINE or OFFLINE",
        );
      if (driver.status === "BUSY") return error(response, 409, "DRIVER_BUSY", "finish the active trip first");
      driver.status = request.body.status;
      return response.json({ driverId: driver.id, status: driver.status });
    });
    app.put("/drivers/me/location", (request, response) => {
      const user = requireUser(request, response, ["DRIVER"]);
      if (!user) return;
      const driver = state.drivers.get(user.profileId);
      if (!driver || driver.applicationStatus !== "APPROVED")
        return error(response, 403, "FORBIDDEN", "driver is not approved");
      if (!validPoint(request.body)) return error(response, 400, "INVALID_ARGUMENT", "invalid coordinates");
      driver.lat = Number(request.body.lat);
      driver.lng = Number(request.body.lng);
      driver.recordedAt = new Date().toISOString();
      return response.json({
        driverId: driver.id,
        lat: driver.lat,
        lng: driver.lng,
        recordedAt: driver.recordedAt,
      });
    });
    app.get("/drivers/nearby", (request, response) => {
      if (!requireUser(request, response, ["CUSTOMER", "ADMIN"])) return;
      const point = {
          lat: Number(request.query.lat),
          lng: Number(request.query.lng),
        },
        radius = Number(request.query.radius ?? 1000),
        page = Number(request.query.page ?? 1),
        limit = Math.min(Number(request.query.limit ?? 20), 100);
      const items = [...state.drivers.values()]
        .filter(
          (driver) =>
            driver.status === (request.query.status ?? "ONLINE") &&
            distanceM(point, driver) <= radius,
        )
        .map((driver) => ({
          id: driver.id,
          fullName: escapeHtml(driver.fullName),
          vehicleType: driver.vehicleType,
          distanceM: distanceM(point, driver),
        }));
      return response.json({
        items: items.slice((page - 1) * limit, page * limit),
        page,
        limit,
        total: items.length,
      });
    });
  }
  if (serviceName === "booking-service") {
    app.post("/fare-estimates", (request, response) => {
      const { pickup, dropoff, vehicleType } = request.body;
      if (
        !pickup ||
        !dropoff ||
        !["BIKE", "SEDAN", "SUV"].includes(vehicleType)
      )
        return error(
          response,
          400,
          "INVALID_ARGUMENT",
          "pickup, dropoff and vehicleType are required",
        );
      const distanceMValue = Math.max(
        1000,
        Math.round(distanceM(pickup, dropoff)),
      );
      return response.json({
        distanceM: distanceMValue,
        estimatedFareVnd: Math.round(15000 + distanceMValue * 8),
        etaMinutes: Math.max(5, Math.round(distanceMValue / 400)),
        currency: "VND",
        tariffVersion: "demo-v1",
      });
    });
    app.post("/bookings", async (request, response) => {
      const user = requireUser(request, response, ["CUSTOMER"]);
      if (!user || !idempotent(request, response, "booking")) return;
      const { pickup, dropoff, vehicleType } = request.body;
      if (!pickup || !dropoff || !["BIKE", "SEDAN", "SUV"].includes(vehicleType))
        return error(
          response,
          400,
          "INVALID_ARGUMENT",
          "pickup, dropoff and vehicleType are required",
        );
      if (
        [...state.bookings.values()].some(
          (item) =>
            item.customerId === user.profileId &&
            ["SEARCHING", "ASSIGNED"].includes(item.status),
        )
      )
        return error(
          response,
          409,
          "ACTIVE_BOOKING_EXISTS",
          "customer already has an active booking",
        );
      const booking = {
        id: crypto.randomUUID(),
        customerId: user.profileId,
        pickup,
        dropoff,
        vehicleType,
        status: "SEARCHING",
        requestedAt: new Date().toISOString(),
        tripId: null,
        driverId: null,
      };
      for (const point of [pickup, dropoff]) if (point.address) point.address = escapeHtml(point.address);
      state.bookings.set(booking.id, booking);
      const candidates = await fetch(
        `http://driver-service:3002/internal/drivers/nearby?lat=${pickup.lat}&lng=${pickup.lng}&vehicleType=${vehicleType}&radius=5000`,
        { headers: { "X-Service-Token": INTERNAL_TOKEN } },
      )
        .then((result) => result.json())
        .catch(() => []);
      if (candidates[0]) {
        const offer = {
          id: crypto.randomUUID(),
          bookingId: booking.id,
          driverId: candidates[0].driverId,
          customerId: user.profileId,
          pickup,
          dropoff,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 150000).toISOString(),
        };
        state.offers.set(offer.id, offer);
        await notify(offer.driverId, "BOOKING_OFFER", offer.id);
      }
      const result = {
        bookingId: booking.id,
        status: booking.status,
        requestedAt: booking.requestedAt,
      };
      saveIdempotency(request, "booking", 201, result);
      return response.status(201).json(result);
    });
    app.get("/bookings", (request, response) => {
      const user = requireUser(request, response, ["CUSTOMER", "ADMIN"]);
      if (!user) return;
      const page = Number(request.query.page ?? 1),
        limit = Math.min(Number(request.query.limit ?? 20), 100),
        items = [...state.bookings.values()]
          .filter(
            (item) =>
              user.role === "ADMIN" || item.customerId === user.profileId,
          )
          .filter(
            (item) =>
              !request.query.status || item.status === request.query.status,
          );
      return response.json({
        items: items
          .slice((page - 1) * limit, page * limit)
          .map((item) => ({
            bookingId: item.id,
            customerId: item.customerId,
            status: item.status,
            vehicleType: item.vehicleType,
            cancelable: ["SEARCHING", "ASSIGNED"].includes(item.status),
            cancelVia: item.tripId ? "TRIP" : "BOOKING",
            activeTripId: item.tripId,
            driverId: item.driverId,
          })),
        page,
        limit,
        total: items.length,
      });
    });
    app.get("/bookings/:id", (request, response) => {
      const user = requireUser(request, response, ["CUSTOMER", "ADMIN"]);
      if (!user) return;
      const item = state.bookings.get(request.params.id);
      if (!item) return error(response, 404, "NOT_FOUND", "booking not found");
      if (user.role !== "ADMIN" && item.customerId !== user.profileId)
        return error(response, 403, "FORBIDDEN", "resource ownership required");
      return response.json({
        bookingId: item.id,
        customerId: item.customerId,
        status: item.status,
        vehicleType: item.vehicleType,
        cancelable: ["SEARCHING", "ASSIGNED"].includes(item.status),
        cancelVia: item.tripId ? "TRIP" : "BOOKING",
        activeTripId: item.tripId,
        driverId: item.driverId,
      });
    });
    app.get("/offers", (request, response) => {
      const user = requireUser(request, response, ["DRIVER"]);
      if (!user) return;
      const items = [...state.offers.values()].filter(
        (offer) => offer.driverId === user.profileId,
      );
      return response.json({ items, page: 1, limit: 20, total: items.length });
    });
    app.get("/offers/:id", (request, response) => {
      const user = requireUser(request, response, ["DRIVER"]);
      if (!user) return;
      const offer = state.offers.get(request.params.id);
      if (!offer) return error(response, 404, "NOT_FOUND", "offer not found");
      if (offer.driverId !== user.profileId)
        return error(response, 403, "FORBIDDEN", "resource ownership required");
      return response.json(offer);
    });
    app.post("/offers/:id/accept", async (request, response) => {
      const user = requireUser(request, response, ["DRIVER"]);
      if (!user || !idempotent(request, response, "offer-accept")) return;
      const offer = state.offers.get(request.params.id);
      if (!offer) return error(response, 404, "NOT_FOUND", "offer not found");
      if (offer.driverId !== user.profileId || offer.status !== "PENDING")
        return error(response, 409, "OFFER_CLOSED", "offer is not available");
      const booking = state.bookings.get(offer.bookingId);
      if (booking.status !== "SEARCHING" || Date.parse(offer.expiresAt) < Date.now()) return error(response, 409, "OFFER_CLOSED", "offer expired or booking closed");
      await internalCall("driver", `/internal/drivers/${user.profileId}/status`, { status: "BUSY", bookingId: booking.id });
      const tripResult = await fetch(
        "http://trip-service:3004/internal/trips",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Service-Token": INTERNAL_TOKEN,
          },
          body: JSON.stringify({
            bookingId: booking.id,
            offerId: offer.id,
            reservationId: crypto.randomUUID(),
            customerId: booking.customerId,
            driverId: user.profileId,
            pickup: booking.pickup,
            dropoff: booking.dropoff,
            vehicleType: booking.vehicleType,
          }),
        },
      ).then((result) => result.json());
      if (!tripResult.tripId) throw new Error("trip creation failed");
      await notify(booking.customerId, "DRIVER_ASSIGNED", tripResult.tripId);
      offer.status = "ACCEPTED";
      booking.status = "ASSIGNED";
      booking.driverId = user.profileId;
      booking.tripId = tripResult.tripId;
      const result = {
        bookingId: booking.id,
        tripId: tripResult.tripId,
        driverId: user.profileId,
        status: "ASSIGNED",
      };
      saveIdempotency(request, "offer-accept", 200, result);
      return response.json(result);
    });
    app.post("/offers/:id/reject", (request, response) => {
      const user = requireUser(request, response, ["DRIVER"]);
      if (!user || !idempotent(request, response, "offer-reject")) return;
      const offer = state.offers.get(request.params.id);
      if (!offer) return error(response, 404, "NOT_FOUND", "offer not found");
      if (offer.driverId !== user.profileId)
        return error(response, 403, "FORBIDDEN", "resource ownership required");
      offer.status = "REJECTED";
      const result = { offerId: offer.id, status: offer.status };
      saveIdempotency(request, "offer-reject", 200, result);
      return response.json(result);
    });
    app.post("/bookings/:id/cancel", async (request, response) => {
      const user = requireUser(request, response, ["CUSTOMER"]);
      if (!user || !idempotent(request, response, "booking-cancel")) return;
      const booking = state.bookings.get(request.params.id);
      if (!booking)
        return error(response, 404, "NOT_FOUND", "booking not found");
      if (booking.customerId !== user.profileId)
        return error(response, 403, "FORBIDDEN", "resource ownership required");
      if (booking.tripId)
        return error(
          response,
          409,
          "TRIP_ALREADY_CREATED",
          "cancel the trip instead",
        );
      if (!request.body.reason)
        return error(response, 400, "INVALID_ARGUMENT", "reason is required");
      if (booking.status !== "SEARCHING") return error(response, 409, "INVALID_STATE", "booking cannot be canceled");
      for (const offer of state.offers.values()) if (offer.bookingId === booking.id) { offer.status = "CANCELED"; await notify(offer.driverId, "BOOKING_CANCELED", booking.id); }
      await notify(booking.customerId, "BOOKING_CANCELED", booking.id);
      booking.status = "CANCELED";
      const result = {
        bookingId: booking.id,
        status: booking.status,
        reason: escapeHtml(request.body.reason),
      };
      saveIdempotency(request, "booking-cancel", 200, result);
      return response.json(result);
    });
  }
  if (serviceName === "trip-service") {
    app.get("/trips/:id", (request, response) => {
      const user = requireUser(request, response, [
        "CUSTOMER",
        "DRIVER",
        "ADMIN",
      ]);
      if (!user) return;
      const trip = state.trips.get(request.params.id);
      if (!trip) return error(response, 404, "NOT_FOUND", "trip not found");
      if (
        user.role !== "ADMIN" &&
        user.profileId !== trip.customerId &&
        user.profileId !== trip.driverId
      )
        return error(response, 403, "FORBIDDEN", "resource ownership required");
      return response.json(trip);
    });
    app.patch("/trips/:id/status", async (request, response) => {
      const user = requireUser(request, response, ["DRIVER"]);
      if (!user) return;
      const trip = state.trips.get(request.params.id);
      if (!trip) return error(response, 404, "NOT_FOUND", "trip not found");
      if (trip.driverId !== user.profileId)
        return error(response, 403, "FORBIDDEN", "assigned driver required");
      const sequence = ["ASSIGNED", "ARRIVED", "IN_PROGRESS", "COMPLETED"],
        next = request.body.status;
      if (next === trip.status) return response.json(trip);
      if (
        !sequence.includes(next) || !sequence.includes(trip.status) || (sequence.indexOf(next) !== sequence.indexOf(trip.status) + 1 &&
        next !== trip.status)
      )
        return error(
          response,
          409,
          "INVALID_TRANSITION",
          "invalid trip status transition",
        );
      if (next === "COMPLETED") {
        await internalCall("booking", `/internal/bookings/${trip.bookingId}/status`, { status: next });
        await internalCall("driver", `/internal/drivers/${trip.driverId}/status`, { status: "ONLINE", bookingId: trip.bookingId });
      }
      await notify(trip.customerId, `TRIP_${next}`, trip.id);
      trip.status = next;
      return response.json(trip);
    });
    app.post("/trips/:id/cancel", async (request, response) => {
      const user = requireUser(request, response, ["CUSTOMER", "DRIVER"]);
      if (!user) return;
      const trip = state.trips.get(request.params.id);
      if (!trip) return error(response, 404, "NOT_FOUND", "trip not found");
      if (
        user.profileId !== trip.customerId &&
        user.profileId !== trip.driverId
      )
        return error(response, 403, "FORBIDDEN", "resource ownership required");
      if (!["ASSIGNED", "ARRIVED"].includes(trip.status))
        return error(response, 409, "INVALID_STATE", "trip cannot be canceled");
      if (!request.body.reason)
        return error(response, 400, "INVALID_ARGUMENT", "reason is required");
      await internalCall("booking", `/internal/bookings/${trip.bookingId}/status`, { status: "CANCELED" });
      await internalCall("driver", `/internal/drivers/${trip.driverId}/status`, { status: "ONLINE", bookingId: trip.bookingId });
      await notify(trip.customerId, "TRIP_CANCELED", trip.id);
      await notify(trip.driverId, "TRIP_CANCELED", trip.id);
      trip.status = "CANCELED";
      trip.canceledBy = user.role;
      trip.reason = escapeHtml(request.body.reason);
      return response.json(trip);
    });
    app.put("/trips/:id/location", (request, response) => {
      const user = requireUser(request, response, ["DRIVER"]);
      if (!user) return;
      const trip = state.trips.get(request.params.id);
      if (!trip) return error(response, 404, "NOT_FOUND", "trip not found");
      if (trip.driverId !== user.profileId) return error(response, 403, "FORBIDDEN", "assigned driver required");
      if (trip.status !== "IN_PROGRESS") return error(response, 409, "INVALID_STATE", "trip not in progress");
      if (!validPoint(request.body)) return error(response, 400, "INVALID_ARGUMENT", "invalid coordinates");
      trip.location = { lat: Number(request.body.lat), lng: Number(request.body.lng), recordedAt: new Date().toISOString() };
      (trip.locations ??= []).push(trip.location);
      return response.json(trip.location);
    });
    app.post("/trips/:id/reviews", (request, response) => {
      const user = requireUser(request, response, ["CUSTOMER"]);
      if (!user || !idempotent(request, response, "review")) return;
      const trip = state.trips.get(request.params.id);
      if (!trip || trip.customerId !== user.profileId)
        return error(response, 403, "FORBIDDEN", "resource ownership required");
      if (trip.status !== "COMPLETED")
        return error(response, 409, "INVALID_STATE", "trip is not completed");
      if (
        !Number.isInteger(request.body.stars) ||
        request.body.stars < 1 ||
        request.body.stars > 5
      )
        return error(response, 400, "INVALID_ARGUMENT", "stars must be 1..5");
      const review = {
        reviewId: crypto.randomUUID(),
        tripId: trip.id,
        stars: request.body.stars,
        comment: escapeHtml(request.body.comment ?? ""),
      };
      trip.review = review;
      saveIdempotency(request, "review", 201, review);
      return response.status(201).json(review);
    });
    app.get("/trips/:id/review", (request, response) => {
      const user = requireUser(request, response, [
        "CUSTOMER",
        "DRIVER",
        "ADMIN",
      ]);
      if (!user) return;
      const trip = state.trips.get(request.params.id);
      if (!trip?.review)
        return error(response, 404, "NOT_FOUND", "review not found");
      if (
        user.role !== "ADMIN" &&
        user.profileId !== trip.customerId &&
        user.profileId !== trip.driverId
      )
        return error(response, 403, "FORBIDDEN", "resource ownership required");
      return response.json(trip.review);
    });
  }
  if (serviceName === "payment-service") {
    app.post("/payments", async (request, response) => {
      const user = requireUser(request, response, ["CUSTOMER"]);
      if (!user || !idempotent(request, response, "payment")) return;
      if (
        Object.keys(request.body).some(
          (field) => !["tripId", "method"].includes(field),
        ) ||
        request.body.method !== "ONLINE"
      )
        return error(
          response,
          400,
          "INVALID_ARGUMENT",
          "only tripId and method=ONLINE are accepted",
        );
      const payable = await fetch(
        `http://trip-service:3004/internal/trips/${request.body.tripId}/payable`,
        { headers: { "X-Service-Token": INTERNAL_TOKEN } },
      ).then((result) => result.json());
      if (!payable.customerId || payable.customerId !== user.profileId)
        return error(response, 403, "FORBIDDEN", "payment owner required");
      if (payable.status !== "COMPLETED" || payable.paymentStatus === "PAID")
        return error(response, 409, "INVALID_STATE", "trip is not payable");
      if ([...state.payments.values()].some(item => item.tripId === request.body.tripId && item.status !== "FAILED")) return error(response, 409, "PAYMENT_EXISTS", "payment already exists for trip");
      const payment = {
        paymentId: crypto.randomUUID(),
        tripId: request.body.tripId,
        customerId: user.profileId,
        status: "PENDING",
        amountVnd: payable.fare.amountVnd,
        providerTxnRef: crypto.randomUUID(),
      };
      state.payments.set(payment.paymentId, payment);
      const result = {
        paymentId: payment.paymentId,
        tripId: payment.tripId,
        status: payment.status,
        amountVnd: payment.amountVnd,
        paymentUrl: "https://sandbox.invalid/pay",
      };
      saveIdempotency(request, "payment", 201, result);
      return response.status(201).json(result);
    });
    app.get("/payments/:id", (request, response) => {
      const user = requireUser(request, response, ["CUSTOMER", "ADMIN"]);
      if (!user) return;
      const payment = state.payments.get(request.params.id);
      if (!payment)
        return error(response, 404, "NOT_FOUND", "payment not found");
      if (user.role !== "ADMIN" && user.profileId !== payment.customerId)
        return error(response, 403, "FORBIDDEN", "payment owner required");
      return response.json(payment);
    });
    app.post("/payments/callback", async (request, response) => {
      const signature = request.get("X-Signature"),
        timestamp = request.get("X-Timestamp"),
        rawBytes = Buffer.isBuffer(request.body)
          ? request.body
          : Buffer.from("");
      const expected = crypto
        .createHmac(
          "sha256",
          process.env.PAYMENT_CALLBACK_SECRET ?? "cab-local-callback-secret",
        )
        .update(`${timestamp}.`)
        .update(rawBytes)
        .digest("hex");
      let data;
      try {
        data = JSON.parse(rawBytes.toString("utf8"));
      } catch {
        return error(
          response,
          400,
          "INVALID_ARGUMENT",
          "callback body must be valid JSON",
        );
      }
      let validSignature = false;
      try {
        validSignature =
          Boolean(signature) &&
          crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
      } catch {
        validSignature = false;
      }
      if (
        !validSignature ||
        !Number.isFinite(Number(timestamp)) ||
        Math.abs(Date.now() - Number(timestamp) * 1000) > 300000
      )
        return error(
          response,
          401,
          "UNAUTHORIZED",
          "invalid callback signature",
        );
      const payment = [...state.payments.values()].find(
        (item) => item.providerTxnRef === data.providerTxnRef,
      );
      if (!payment)
        return error(response, 404, "NOT_FOUND", "payment not found");
      if (payment.status === "COMPLETED")
        return response.json({ result: "SUCCESS" });
      if (Number(data.amountVnd) !== payment.amountVnd)
        return error(
          response,
          422,
          "AMOUNT_MISMATCH",
          "callback amount does not match",
        );
      payment.status = data.status === "SUCCESS" ? "COMPLETED" : "FAILED";
      if (payment.status === "COMPLETED")
        await fetch(
          `http://trip-service:3004/internal/trips/${payment.tripId}/paid`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Service-Token": INTERNAL_TOKEN,
            },
            body: "{}",
          },
        );
      return response.json({ result: payment.status });
    });
    app.post("/payments/:id/sandbox-confirm", async (request, response) => {
      const user = requireUser(request, response, ["CUSTOMER"]);
      if (!user) return;
      if (process.env.SANDBOX_MODE !== "true")
        return error(response, 400, "SANDBOX_DISABLED", "sandbox is disabled");
      const payment = state.payments.get(request.params.id);
      if (!payment)
        return error(response, 404, "NOT_FOUND", "payment not found");
      if (payment.customerId !== user.profileId)
        return error(
          response,
          403,
          "payment owner required",
          "payment owner required",
        );
      if (payment.status === "COMPLETED") return response.json({ result: payment.status });
      payment.status =
        request.body.scenario === "FAIL" ? "FAILED" : "COMPLETED";
      if (payment.status === "COMPLETED")
        await fetch(
          `http://trip-service:3004/internal/trips/${payment.tripId}/paid`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Service-Token": INTERNAL_TOKEN,
            },
            body: "{}",
          },
        );
      return response.json({ result: payment.status });
    });
  }
  if (serviceName === "notification-service") {
    app.get("/notifications", (request, response) => {
      const user = requireUser(request, response, ["CUSTOMER", "DRIVER"]);
      if (!user) return;
      const items = [...state.notifications.values()].filter(
        (item) =>
          item.recipientId === user.profileId &&
          (!request.query.unread || !item.readAt),
      );
      return response.json({ items, page: 1, limit: 20, total: items.length });
    });
    app.patch("/notifications/:id/read", (request, response) => {
      const user = requireUser(request, response, ["CUSTOMER", "DRIVER"]);
      if (!user) return;
      const item = state.notifications.get(request.params.id);
      if (!item)
        return error(response, 404, "NOT_FOUND", "notification not found");
      if (item.recipientId !== user.profileId)
        return error(response, 403, "FORBIDDEN", "notification owner required");
      item.readAt = new Date().toISOString();
      return response.json(item);
    });
  }
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
