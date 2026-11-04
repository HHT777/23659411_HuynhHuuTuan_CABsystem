export function registerRoutes(app, context) {
  const { state, INTERNAL_TOKEN, crypto, hashPassword, passwordMatches, internalCall, notify, validPoint, encryptField, escapeHtml, tokenFor, parseToken, error, requireUser, requireInternal, idempotent, saveIdempotency, distanceM } = context;
    app.post("/internal/accounts/:id/status", (request, response) => {
      const user = state.users.get(request.params.id);
      if (!user) return error(response, 404, "NOT_FOUND", "account not found");
      user.status = request.body.status;
      return response.json({ status: user.status });
    });
    app.post("/internal/accounts/drivers", (request, response) => {
      const { driverId, password, email, phone, fullName } = request.body;
      if (!driverId || !password)
        return error(response, 400, "INVALID_ARGUMENT", "driverId and password are required");
      state.users.set(driverId, {
        id: driverId, profileId: driverId, fullName, role: "DRIVER",
        status: "PENDING_APPROVAL", email, phone, password: hashPassword(password),
      });
      return response.status(201).json({ accountId: driverId });
    });
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
        fullName,
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
