import express from "express";
import { randomUUID } from "node:crypto";
import crypto from "node:crypto";
import { gatewayConfig } from "./config/env.js";
import { verifyJwt } from "../../shared/jwt.js";
import { publicEndpointCatalog } from "./routes/endpoints.routes.js";

const services = {
  "identity-service": ["identity-service", 3000],
  "customer-service": ["customer-service", 3001],
  "driver-service": ["driver-service", 3002],
  "booking-service": ["booking-service", 3003],
  "trip-service": ["trip-service", 3004],
  "payment-service": ["payment-service", 3005],
  "notification-service": ["notification-service", 3006],
};

export const routes = [
  ["/auth", "identity-service"],
  ["/customers", "customer-service"],
  ["/drivers", "driver-service"],
  ["/admin/drivers", "driver-service"],
  ["/fare-estimates", "booking-service"],
  ["/bookings", "booking-service"],
  ["/offers", "booking-service"],
  ["/trips", "trip-service"],
  ["/payments", "payment-service"],
  ["/notifications", "notification-service"],
];

function endpointFor(name) {
  const overrides = process.env.SERVICE_URLS_JSON
    ? JSON.parse(process.env.SERVICE_URLS_JSON)
    : {};
  return overrides[name] ?? `http://${services[name][0]}:${services[name][1]}`;
}

export function targetFor(path) {
  return routes.find(
    ([prefix]) => path === prefix || path.startsWith(`${prefix}/`),
  )?.[1];
}

const rateWindows = new Map();
function protectedRoute(path) {
  return (
    path !== "/" &&
    path !== "/endpoints" &&
    !path.startsWith("/auth/") &&
    !path.startsWith("/drivers/otp/") &&
    path !== "/drivers/register" &&
    path !== "/payments/callback"
  );
}
function allowed(request, response) {
  if (!protectedRoute(request.path)) return true;
  const claims = verifyJwt(request.get("Authorization"));
  if (!claims) {
    response
      .status(401)
      .json({
        error: { code: "UNAUTHORIZED", message: "valid access token required" },
      });
    return false;
  }
  request.user = claims;
  if (request.path.startsWith("/admin/") && claims.role !== "ADMIN") {
    response
      .status(403)
      .json({ error: { code: "FORBIDDEN", message: "admin role required" } });
    return false;
  }
  if (
    (request.path.startsWith("/offers") ||
      request.path.startsWith("/drivers/me/")) &&
    claims.role !== "DRIVER"
  ) {
    response
      .status(403)
      .json({ error: { code: "FORBIDDEN", message: "driver role required" } });
    return false;
  }
  if (
    request.path.startsWith("/bookings") ||
    request.path.startsWith("/fare-estimates") ||
    request.path.startsWith("/payments")
  ) {
    if (
      !["CUSTOMER", "ADMIN"].includes(claims.role) &&
      !request.path.startsWith("/offers")
    ) {
      response
        .status(403)
        .json({
          error: { code: "FORBIDDEN", message: "customer role required" },
        });
      return false;
    }
  }
  return true;
}

async function serviceChecks(token) {
  return Promise.all(
    Object.entries(services).map(async ([name, [host, port]]) => {
      try {
        const result = await fetch(`${endpointFor(name)}/ready`, {
          headers: { "X-Service-Token": token },
        });
        const payload = await result.json();
        return {
          name,
          status: result.ok ? "up" : "down",
          dependencies: payload.dependencies ?? [],
        };
      } catch {
        return { name, status: "down", dependencies: [] };
      }
    }),
  );
}

export function createGatewayApp() {
  const { token } = gatewayConfig();
  const app = express();
  app.use((request, response, next) => {
    response.set("X-Request-ID", request.get("X-Request-ID") ?? randomUUID());
    next();
  });
  app.use(
    "/payments/callback",
    express.raw({ type: "application/json", limit: "1mb" }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use((request, response, next) => {
    const path = request.path.replace(/\/+$/, "") || "/";
    const claims = verifyJwt(request.get("Authorization"));
    const windowKey = `${claims?.sub ?? request.ip}:${request.method}:${path}`;
    const now = Date.now();
    const limit =
      path === "/auth/login"
        ? 10
        : path === "/bookings" && request.method === "POST"
          ? 5
          : 100;
    const current = rateWindows.get(windowKey) ?? { started: now, count: 0 };
    if (now - current.started >= 60000) {
      current.started = now;
      current.count = 0;
    }
    current.count += 1;
    rateWindows.set(windowKey, current);
    if (rateWindows.size > 1000) for (const [key, entry] of rateWindows) if (now - entry.started >= 60000) rateWindows.delete(key);
    if (current.count > limit) {
      response.set("Retry-After", "60");
      return response
        .status(429)
        .json({
          error: { code: "RATE_LIMITED", message: "too many requests" },
        });
    }
    return next();
  });
  app.get("/health", (_request, response) =>
    response.json({ status: "healthy", service: "gateway" }),
  );
  app.get("/", (_request, response) =>
    response.json({
      service: "gateway",
      status: "running",
      health: "/health",
      readiness: "/ready",
      endpointCatalog: "/endpoints",
    }),
  );
  app.get("/endpoints", (_request, response) =>
    response.json({
      baseUrl: "http://localhost:8000",
      note: "Use these public paths through the Gateway. Login first for endpoints requiring Authorization.",
      gatewayEndpoints: [
        { method: "GET", path: "/", description: "Gateway metadata" },
        { method: "GET", path: "/health", description: "Gateway liveness" },
        { method: "GET", path: "/ready", description: "Readiness of the full stack" },
        { method: "GET", path: "/health/services", description: "Health of all services" },
        { method: "GET", path: "/endpoints", description: "This endpoint catalog" },
      ],
      services: publicEndpointCatalog(),
    }),
  );
  app.use("/internal", (_request, response) =>
    response.status(404).json({ error: "route not found" }),
  );
  app.get("/health/services", async (_request, response) => {
    const checked = await serviceChecks(token);
    const ready = checked.every((service) => service.status === "up");
    response
      .status(ready ? 200 : 503)
      .json({ services: checked, checkedAt: new Date().toISOString() });
  });
  app.get("/ready", async (_request, response) => {
    const checked = await serviceChecks(token);
    const ready = checked.every((service) => service.status === "up");
    response.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "not_ready",
      service: "gateway",
      services: checked,
    });
  });
  app.use(async (request, response) => {
    const serviceName = targetFor(request.path);
    if (!serviceName)
      return response.status(404).json({ error: "route not found" });
    if (!allowed(request, response)) return undefined;
    const headers = {
      "X-Service-Token": token,
      "X-Request-ID": response.getHeader("X-Request-ID"),
    };
    if (request.get("Content-Type"))
      headers["Content-Type"] = request.get("Content-Type");
    for (const name of [
      "Authorization",
      "Idempotency-Key",
      "X-Signature",
      "X-Timestamp",
    ])
      if (request.get(name)) headers[name] = request.get(name);
    try {
      const upstream = await fetch(
        `${endpointFor(serviceName)}${request.originalUrl}`,
        {
          method: request.method,
          headers,
          body: ["GET", "HEAD"].includes(request.method)
            ? undefined
            : Buffer.isBuffer(request.body)
              ? request.body
              : JSON.stringify(request.body ?? {}),
        },
      );
      response
        .status(upstream.status)
        .type(upstream.headers.get("content-type") ?? "application/json")
        .send(await upstream.text());
    } catch {
      response
        .status(503)
        .json({ error: "service unavailable", service: serviceName });
    }
  });
  return app;
}
