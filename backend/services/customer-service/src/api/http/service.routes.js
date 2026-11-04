export function registerRoutes(app, context) {
  const { state, INTERNAL_TOKEN, crypto, hashPassword, passwordMatches, internalCall, notify, validPoint, encryptField, escapeHtml, tokenFor, parseToken, error, requireUser, requireInternal, idempotent, saveIdempotency, distanceM } = context;
    const customerView = (customer) => customer;
    app.post("/internal/customers", (request, response) => {
      const { userId, fullName, email, phone } = request.body;
      const customer = state.customers.get(userId) ?? {
        id: userId, userId, fullName: escapeHtml(fullName), email, phone,
        createdAt: new Date().toISOString(),
      };
      state.customers.set(userId, customer);
      return response.status(201).json({ customerId: customer.id });
    });
    app.get("/customers", (request, response) => {
      const user = requireUser(request, response, ["ADMIN"]);
      if (!user) return;
      const items = [...state.customers.values()].map(customerView);
      return response.json({ items, total: items.length });
    });
    app.get("/customers/me", (request, response) => {
      const user = requireUser(request, response, ["CUSTOMER"]);
      if (!user) return;
      const customer = state.customers.get(user.profileId);
      return customer
        ? response.json(customerView(customer))
        : error(response, 404, "NOT_FOUND", "customer not found");
    });
    app.get("/customers/:id", (request, response) => {
      const user = requireUser(request, response, ["CUSTOMER", "ADMIN"]);
      if (!user) return;
      if (user.role === "CUSTOMER" && user.profileId !== request.params.id)
        return error(response, 403, "FORBIDDEN", "resource ownership required");
      const customer = state.customers.get(request.params.id);
      return customer
        ? response.json({
            ...customerView(customer),
            fullName: customer.fullName,
          })
        : error(response, 404, "NOT_FOUND", "customer not found");
    });
}
