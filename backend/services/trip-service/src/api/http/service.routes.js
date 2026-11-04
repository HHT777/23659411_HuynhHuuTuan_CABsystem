export function registerRoutes(app, context) {
  const { state, INTERNAL_TOKEN, crypto, hashPassword, passwordMatches, internalCall, notify, validPoint, encryptField, escapeHtml, tokenFor, parseToken, error, requireUser, requireInternal, idempotent, saveIdempotency, distanceM } = context;
    app.get("/internal/trips/:id/payable", (request, response) => {
      const trip = state.trips.get(request.params.id);
      if (!trip) return error(response, 404, "NOT_FOUND", "trip not found");
      return response.json({ customerId: trip.customerId, status: trip.status,
        fare: { amountVnd: trip.amountVnd, currency: "VND", tariffVersion: "pc19-900-vnd-per-100m" },
        paymentStatus: trip.paymentStatus });
    });
    app.post("/internal/trips/:id/paid", (request, response) => {
      const trip = state.trips.get(request.params.id);
      if (!trip) return error(response, 404, "NOT_FOUND", "trip not found");
      if (trip.status !== "COMPLETED")
        return error(response, 409, "INVALID_STATE", "trip is not completed");
      trip.paymentStatus = "PAID";
      return response.json({ tripId: trip.id, paymentStatus: trip.paymentStatus });
    });
    app.get("/internal/customers/:id/active-trip", (request, response) => {
      const trip = [...state.trips.values()].find((item) => item.customerId === request.params.id &&
        ["ASSIGNED", "ARRIVED", "IN_PROGRESS"].includes(item.status));
      return trip
        ? response.json({ tripId: trip.id, status: trip.status })
        : error(response, 404, "NOT_FOUND", "no active trip");
    });
    app.post("/internal/trips", (request, response) => {
      const data = request.body;
      let trip = [...state.trips.values()].find((item) => item.bookingId === data.bookingId);
      if (!trip) {
        trip = { id: crypto.randomUUID(), bookingId: data.bookingId, customerId: data.customerId,
          driverId: data.driverId, status: "ASSIGNED", amountVnd: Number(data.amountVnd),
          paymentStatus: "UNPAID",
          pickup: data.pickup, destination: data.destination ?? data.dropoff,
          dropoff: data.destination ?? data.dropoff, vehicleType: data.vehicleType };
        state.trips.set(trip.id, trip);
      }
      return response.status(201).json({ tripId: trip.id, bookingId: trip.bookingId,
        driverId: trip.driverId, status: trip.status });
    });
    app.post("/internal/trips/:id/cancel", async (request, response) => {
      const trip = state.trips.get(request.params.id);
      if (!trip) return error(response, 404, "NOT_FOUND", "trip not found");
      if (request.body.customerId && request.body.customerId !== trip.customerId)
        return error(response, 403, "FORBIDDEN", "resource ownership required");
      if (trip.status === "CANCELED") return response.json(trip);
      if (!["ASSIGNED", "ARRIVED"].includes(trip.status))
        return error(response, 409, "INVALID_STATE", "trip cannot be canceled");
      if (!request.body.reason)
        return error(response, 400, "INVALID_ARGUMENT", "reason is required");
      await internalCall("driver", `/internal/drivers/${trip.driverId}/status`, { status: "ONLINE", bookingId: trip.bookingId });
      await notify(trip.customerId, "TRIP_CANCELED", trip.id);
      await notify(trip.driverId, "TRIP_CANCELED", trip.id);
      trip.status = "CANCELED";
      trip.canceledAt = new Date().toISOString();
      trip.canceledBy = "CUSTOMER";
      trip.reason = escapeHtml(request.body.reason);
      trip.paymentStatus = "UNPAID";
      return response.json(trip);
    });
    app.get("/trips", (request, response) => {
      const user = requireUser(request, response, ["CUSTOMER"]);
      if (!user) return;
      const items = [...state.trips.values()].filter(
        (trip) => trip.customerId === user.profileId,
      );
      return response.json({ items, total: items.length, customerId: user.profileId });
    });
    app.get("/trips/:id", (request, response) => {
      const user = requireUser(request, response, [
        "CUSTOMER",
        "DRIVER",
        "ADMIN",
      ]);
      if (!user) return;
      if (user.role === "ADMIN" && !state.trips.has(request.params.id)) {
        const items = [...state.trips.values()].filter(
          (trip) => trip.customerId === request.params.id,
        );
        return response.json({ items, total: items.length, customerId: request.params.id });
      }
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
        trip.completedAt = new Date().toISOString();
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
      trip.paymentStatus = "UNPAID";
      trip.canceledAt = new Date().toISOString();
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
