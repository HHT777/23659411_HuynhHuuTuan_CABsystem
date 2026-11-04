export function registerRoutes(app, context) {
  const { state, INTERNAL_TOKEN, crypto, hashPassword, passwordMatches, internalCall, notify, validPoint, encryptField, escapeHtml, tokenFor, parseToken, error, requireUser, requireInternal, idempotent, saveIdempotency, distanceM } = context;
    const driverView = (driver) => driver;
    app.post("/internal/drivers/:id/status", (request, response) => {
      const driver = state.drivers.get(request.params.id);
      if (!driver) return error(response, 404, "NOT_FOUND", "driver not found");
      if (request.body.status === "BUSY" && driver.status !== "ONLINE" && driver.bookingId !== request.body.bookingId)
        return error(response, 409, "DRIVER_BUSY", "driver unavailable");
      if (request.body.status === "ONLINE" && driver.bookingId && driver.bookingId !== request.body.bookingId)
        return error(response, 409, "DRIVER_BUSY", "another booking owns driver reservation");
      driver.status = request.body.status;
      driver.bookingId = request.body.status === "BUSY" ? request.body.bookingId ?? null : null;
      return response.json({ status: driver.status });
    });
    app.get("/internal/drivers/nearby", (request, response) => {
      const point = { lat: Number(request.query.lat), lng: Number(request.query.lng) };
      const radius = Number(request.query.radius ?? 3000);
      return response.json([...state.drivers.values()]
        .filter((driver) => driver.status === "ONLINE" &&
          (!request.query.vehicleType || driver.vehicleType === request.query.vehicleType) &&
          distanceM(point, driver) <= radius)
        .sort((a, b) => distanceM(point, a) - distanceM(point, b))
        .map((driver) => ({ driverId: driver.id, vehicleType: driver.vehicleType,
          distanceM: distanceM(point, driver), lat: driver.lat, lng: driver.lng })));
    });
    app.get("/drivers", (request, response) => {
      const user = requireUser(request, response, ["ADMIN"]);
      if (!user) return;
      const items = [...state.drivers.values()].map((driver) => ({
        ...driverView(driver), citizenId: driver.citizenId ? "***masked***" : null, licenseNumber: driver.licenseNumber ? "***masked***" : null,
      }));
      return response.json({ items, total: items.length });
    });
    app.get("/drivers/me", (request, response) => {
      const user = requireUser(request, response, ["DRIVER"]);
      if (!user) return;
      const driver = state.drivers.get(user.profileId);
      return driver
        ? response.json({ ...driverView(driver), citizenId: driver.citizenId ? "***masked***" : null, licenseNumber: driver.licenseNumber ? "***masked***" : null })
        : error(response, 404, "NOT_FOUND", "driver not found");
    });
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
              ...driverView(driver),
              citizenId: driver.citizenId ? "***masked***" : null,
              licenseNumber: driver.licenseNumber ? "***masked***" : null,
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
      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
      state.idempotency.set(`otp:${request.body.phone}`, {
        challengeId,
        code, expiresAt: Date.now() + 300000,
      });
      const result = {
        challengeId,
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      };
      if (process.env.SANDBOX_MODE === "true") result.otpCode = code;
      return response.status(202).json(result);
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
      if (!registration || registration.role !== "DRIVER" || !proof || (request.body.phone && proof.phone !== request.body.phone) || proof.expiresAt < Date.now()) return error(response, 401, "UNAUTHORIZED", "verified phone registration required");
      if (state.drivers.has(driverId)) return error(response, 409, "ALREADY_EXISTS", "driver already registered");
      if (!request.body.fullName || !request.body.email || !request.body.password || request.body.password.length < 6 || !["BIKE", "SEDAN", "SUV"].includes(request.body.vehicleType) || !request.body.plate) return error(response, 400, "INVALID_ARGUMENT", "fullName, email, password, vehicleType and plate are required");
      const driver = {
        id: driverId,
        userId: driverId,
        fullName: escapeHtml(request.body.fullName),
        vehicleType: request.body.vehicleType ?? "BIKE",
        plate: request.body.plate,
        ...(request.body.citizenId ? { citizenId: encryptField(request.body.citizenId) } : {}),
        ...(request.body.licenseNumber ? { licenseNumber: encryptField(request.body.licenseNumber) } : {}),
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
        phone: proof.phone,
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
          email: request.body.email, phone: proof.phone,
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
        items: items.slice((page - 1) * limit, page * limit).map(driverView),
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
            ...driverView(driver),
            citizenId: driver.citizenId ? "***masked***" : null,
            licenseNumber: driver.licenseNumber ? "***masked***" : null,
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
        radius = Number(request.query.radius ?? 3000),
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
