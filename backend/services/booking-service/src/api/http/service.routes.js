export function registerRoutes(app, context) {
  const { state, INTERNAL_TOKEN, crypto, hashPassword, passwordMatches, internalCall, notify, validPoint, encryptField, escapeHtml, tokenFor, parseToken, error, requireUser, requireInternal, idempotent, saveIdempotency, distanceM, calculateFareVnd } = context;
    const bookingPoints = (body) => ({
      pickup: body.pick
        ? { ...body.pick, ...(body.pick.add !== undefined ? { address: body.pick.add } : {}) }
        : body.pickup,
      destination: body.des
        ? { ...body.des, ...(body.des.add !== undefined ? { address: body.des.add } : {}) }
        : body.destination ?? body.dropoff,
    });
    const expireSearchingBookings = async () => {
      const now = Date.now();
      for (const booking of state.bookings.values()) {
        if (booking.status === "SEARCHING" && Date.parse(booking.requestedAt) + 30 * 60 * 1000 <= now) {
          booking.status = "EXPIRED";
          for (const offer of state.offers.values())
            if (offer.bookingId === booking.id && offer.status === "PENDING") offer.status = "EXPIRED";
        }
      }
    };
    app.post("/internal/bookings/expire", async (_request, response) => {
      await expireSearchingBookings();
      return response.json({ status: "OK" });
    });
    const expirationTimer = setInterval(() => {
      void fetch(`http://127.0.0.1:${process.env.SERVICE_PORT ?? 3003}/internal/bookings/expire`, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Service-Token": INTERNAL_TOKEN }, body: "{}",
      }).catch(() => {});
    }, 30_000);
    expirationTimer.unref();
    app.post("/internal/bookings/:id/status", (request, response) => {
      const booking = state.bookings.get(request.params.id);
      if (!booking) return error(response, 404, "NOT_FOUND", "booking not found");
      booking.status = request.body.status;
      return response.json(booking);
    });
    app.post("/fare-estimates", (request, response) => {
      const { pickup, vehicleType } = request.body;
      const destination = request.body.destination ?? request.body.dropoff;
      if (
        !pickup ||
        !destination ||
        !["BIKE", "SEDAN", "SUV"].includes(vehicleType)
      )
        return error(
          response,
          400,
          "INVALID_ARGUMENT",
          "pickup, destination and vehicleType are required",
        );
      const distanceMValue = Math.max(1, Math.round(distanceM(pickup, destination)));
      return response.json({
        distanceM: distanceMValue,
        estimatedFareVnd: calculateFareVnd(distanceMValue),
        etaMinutes: Math.max(5, Math.round(distanceMValue / 400)),
        currency: "VND",
        tariffVersion: "pc19-900-vnd-per-100m",
      });
    });
    app.post("/bookings", async (request, response) => {
      const user = requireUser(request, response, ["CUSTOMER"]);
      if (!user || !idempotent(request, response, "booking")) return;
      await expireSearchingBookings();
      const { pickup, destination } = bookingPoints(request.body);
      const { vehicleType } = request.body;
      if (!pickup || !destination || !["BIKE", "SEDAN", "SUV"].includes(vehicleType))
        return error(
          response,
          400,
          "INVALID_ARGUMENT",
          "pick, des and vehicleType are required",
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
      const distanceMValue = Math.max(1, Math.round(distanceM(pickup, destination)));
      const booking = {
        id: crypto.randomUUID(),
        customerId: user.profileId,
        pickup,
        destination,
        dropoff: destination,
        vehicleType,
        status: "SEARCHING",
        requestedAt: new Date().toISOString(),
        tripId: null,
        driverId: null,
        distanceM: distanceMValue,
        quotedFareVnd: calculateFareVnd(distanceMValue),
      };
      for (const point of [pickup, destination]) if (point.address) point.address = escapeHtml(point.address);
      state.bookings.set(booking.id, booking);
      const candidates = await fetch(
        `http://driver-service:3002/internal/drivers/nearby?lat=${pickup.lat}&lng=${pickup.lng}&vehicleType=${vehicleType}&radius=3000`,
        { headers: { "X-Service-Token": INTERNAL_TOKEN } },
      )
        .then((result) => result.json())
        .catch(() => []);
      const expiresAt = new Date(Date.parse(booking.requestedAt) + 30 * 60 * 1000).toISOString();
      for (const driverId of new Set(Array.isArray(candidates) ? candidates.map((candidate) => candidate.driverId).filter(Boolean) : [])) {
        const offer = {
          id: crypto.randomUUID(),
          bookingId: booking.id,
          driverId,
          customerId: user.profileId,
          pickup,
          destination,
          dropoff: destination,
          tripId: null,
          status: "PENDING",
          expiresAt,
        };
        state.offers.set(offer.id, offer);
        await notify(offer.driverId, "BOOKING_OFFER", offer.id);
      }
      const result = {
        bookingId: booking.id,
        status: booking.status,
        requestedAt: booking.requestedAt,
        distanceM: booking.distanceM,
        quotedFareVnd: booking.quotedFareVnd,
      };
      saveIdempotency(request, "booking", 201, result);
      return response.status(201).json(result);
    });
    app.get("/bookings", async (request, response) => {
      const user = requireUser(request, response, ["CUSTOMER", "ADMIN"]);
      if (!user) return;
      await expireSearchingBookings();
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
            pickup: item.pickup,
            destination: item.destination ?? item.dropoff,
            cancelable: ["SEARCHING", "ASSIGNED"].includes(item.status),
            cancelVia: item.tripId ? "TRIP" : "BOOKING",
            activeTripId: item.tripId,
            driverId: item.driverId,
            distanceM: item.distanceM,
            quotedFareVnd: item.quotedFareVnd,
          })),
        page,
        limit,
        total: items.length,
      });
    });
    app.get("/bookings/:id", async (request, response) => {
      const user = requireUser(request, response, ["CUSTOMER", "ADMIN"]);
      if (!user) return;
      await expireSearchingBookings();
      if (user.role === "ADMIN" && !state.bookings.has(request.params.id)) {
        const items = [...state.bookings.values()].filter(
          (booking) => booking.customerId === request.params.id,
        );
        return response.json({ items, total: items.length, customerId: request.params.id });
      }
      const item = state.bookings.get(request.params.id);
      if (!item) return error(response, 404, "NOT_FOUND", "booking not found");
      if (user.role !== "ADMIN" && item.customerId !== user.profileId)
        return error(response, 403, "FORBIDDEN", "resource ownership required");
      return response.json({
        bookingId: item.id,
        customerId: item.customerId,
        status: item.status,
        vehicleType: item.vehicleType,
        pickup: item.pickup,
        destination: item.destination ?? item.dropoff,
        cancelable: ["SEARCHING", "ASSIGNED"].includes(item.status),
        cancelVia: item.tripId ? "TRIP" : "BOOKING",
        activeTripId: item.tripId,
        driverId: item.driverId,
        distanceM: item.distanceM,
        quotedFareVnd: item.quotedFareVnd,
      });
    });
    app.get("/offers", async (request, response) => {
      const user = requireUser(request, response, ["DRIVER"]);
      if (!user) return;
      await expireSearchingBookings();
      const now = Date.now();
      const items = [...state.offers.values()].filter((offer) => {
        const booking = state.bookings.get(offer.bookingId);
        return (
          offer.driverId === user.profileId &&
          offer.status === "PENDING" &&
          booking?.status === "SEARCHING" &&
          Date.parse(offer.expiresAt) > now
        );
      });
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
      await expireSearchingBookings();
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
            destination: booking.destination ?? booking.dropoff,
            dropoff: booking.destination ?? booking.dropoff,
            vehicleType: booking.vehicleType,
            amountVnd: booking.quotedFareVnd,
          }),
        },
      ).then((result) => result.json());
      if (!tripResult.tripId) throw new Error("trip creation failed");
      await notify(booking.customerId, "DRIVER_ASSIGNED", tripResult.tripId);
      offer.status = "ACCEPTED";
      for (const otherOffer of state.offers.values()) {
        if (otherOffer.bookingId === booking.id && otherOffer.id !== offer.id && otherOffer.status === "PENDING") {
          otherOffer.status = "CANCELED";
        }
      }
      booking.status = "ASSIGNED";
      booking.driverId = user.profileId;
      booking.tripId = tripResult.tripId;
      const result = {
        bookingId: booking.id,
        tripId: tripResult.tripId,
        driverId: user.profileId,
        status: "ASSIGNED",
      };
      offer.tripId = tripResult.tripId;
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
      await expireSearchingBookings();
      const booking = state.bookings.get(request.params.id);
      if (!booking)
        return error(response, 404, "NOT_FOUND", "booking not found");
      if (booking.customerId !== user.profileId)
        return error(response, 403, "FORBIDDEN", "resource ownership required");
      if (!request.body.reason)
        return error(response, 400, "INVALID_ARGUMENT", "reason is required");
      if (!["SEARCHING", "ASSIGNED"].includes(booking.status)) return error(response, 409, "INVALID_STATE", "booking cannot be canceled");
      const reason = escapeHtml(request.body.reason);
      if (booking.status === "ASSIGNED") {
        if (!booking.tripId) return error(response, 409, "INVALID_STATE", "assigned booking has no trip");
        await internalCall("trip", `/internal/trips/${booking.tripId}/cancel`, {
          customerId: user.profileId,
          reason,
        });
      }
      for (const offer of state.offers.values()) if (offer.bookingId === booking.id && offer.status === "PENDING") { offer.status = "CANCELED"; await notify(offer.driverId, "BOOKING_CANCELED", booking.id); }
      await notify(booking.customerId, "BOOKING_CANCELED", booking.id);
      booking.status = "CANCELED";
      booking.cancelReason = reason;
      const result = {
        bookingId: booking.id,
        status: booking.status,
        reason,
      };
      saveIdempotency(request, "booking-cancel", 200, result);
      return response.json(result);
    });
}
