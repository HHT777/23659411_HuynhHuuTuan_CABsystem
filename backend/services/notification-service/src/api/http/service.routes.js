export function registerRoutes(app, context) {
  const { state, INTERNAL_TOKEN, crypto, hashPassword, passwordMatches, internalCall, notify, validPoint, encryptField, escapeHtml, tokenFor, parseToken, error, requireUser, requireInternal, idempotent, saveIdempotency, distanceM } = context;
    app.post("/internal/notifications", (request, response) => {
      const id = `${request.body.recipientId}:${request.body.type}:${request.body.resourceId}`;
      const item = state.notifications.get(id) ?? {
        id, ...request.body, createdAt: new Date().toISOString(), readAt: null,
      };
      state.notifications.set(id, item);
      return response.status(201).json(item);
    });
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
