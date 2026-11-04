export function registerRoutes(app, context) {
  const {
    state,
    INTERNAL_TOKEN,
    crypto,
    error,
    requireUser,
    idempotent,
    saveIdempotency,
  } = context;

  const findByTrip = (tripId) =>
    [...state.payments.values()].find((payment) => payment.tripId === tripId);

  const markTripPaid = async (payment) => {
    if (payment.status === "COMPLETED") return payment;
    const result = await fetch(
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
    if (!result.ok) throw new Error(`trip payment update failed: ${result.status}`);
    payment.status = "COMPLETED";
    payment.paidAt = new Date().toISOString();
    payment.updatedAt = payment.paidAt;
    return payment;
  };

  app.post("/payments", async (request, response) => {
    const user = requireUser(request, response, ["CUSTOMER"]);
    if (!user || !idempotent(request, response, "payment")) return;
    if (
      Object.keys(request.body).some(
        (field) => !["tripId", "method"].includes(field),
      ) ||
      !request.body.tripId ||
      request.body.method !== "ONLINE"
    )
      return error(
        response,
        400,
        "INVALID_ARGUMENT",
        "tripId and method=ONLINE are required",
      );

    const payableResponse = await fetch(
      `http://trip-service:3004/internal/trips/${request.body.tripId}/payable`,
      { headers: { "X-Service-Token": INTERNAL_TOKEN } },
    );
    const payable = await payableResponse.json();
    if (!payableResponse.ok)
      return error(
        response,
        payableResponse.status,
        payable.error?.code ?? "TRIP_UNAVAILABLE",
        payable.error?.message ?? "trip is unavailable",
      );
    if (payable.customerId !== user.profileId)
      return error(response, 403, "FORBIDDEN", "trip owner required");
    if (payable.status !== "COMPLETED")
      return error(
        response,
        409,
        "INVALID_STATE",
        "trip must be completed before payment",
      );
    if (payable.paymentStatus === "PAID")
      return error(response, 409, "ALREADY_PAID", "trip is already paid");
    if (findByTrip(request.body.tripId))
      return error(
        response,
        409,
        "PAYMENT_EXISTS",
        "payment already exists for this trip",
      );

    const paymentId = crypto.randomUUID();
    const payment = {
      paymentId,
      tripId: request.body.tripId,
      customerId: user.profileId,
      amountVnd: Number(payable.fare.amountVnd),
      currency: payable.fare.currency ?? "VND",
      method: "ONLINE",
      status: "PENDING",
      attemptCount: 1,
      providerTxnRef: `sandbox-${crypto.randomUUID()}`,
      paymentUrl: `/api/v1/payments/${paymentId}/sandbox-confirm`,
      createdAt: new Date().toISOString(),
    };
    state.payments.set(payment.paymentId, payment);
    const result = {
      paymentId: payment.paymentId,
      tripId: payment.tripId,
      status: payment.status,
      amountVnd: payment.amountVnd,
      currency: payment.currency,
      method: payment.method,
      providerTxnRef: payment.providerTxnRef,
      paymentUrl: payment.paymentUrl,
    };
    saveIdempotency(request, "payment", 201, result);
    return response.status(201).json(result);
  });

  app.get("/payments/:id", (request, response) => {
    const user = requireUser(request, response, ["CUSTOMER", "ADMIN"]);
    if (!user) return;
    const payment = state.payments.get(request.params.id);
    if (!payment) return error(response, 404, "NOT_FOUND", "payment not found");
    if (user.role !== "ADMIN" && user.profileId !== payment.customerId)
      return error(response, 403, "FORBIDDEN", "payment owner required");
    return response.json(payment);
  });

  app.post("/payments/callback", async (request, response) => {
    const signature = request.get("X-Signature");
    const timestamp = request.get("X-Timestamp");
    const rawBytes = Buffer.isBuffer(request.body) ? request.body : Buffer.from("");
    const expected = crypto
      .createHmac(
        "sha256",
        process.env.PAYMENT_CALLBACK_SECRET ?? "cab-local-callback-secret",
      )
      .update(`${timestamp}.`)
      .update(rawBytes)
      .digest("hex");
    let validSignature = false;
    try {
      validSignature =
        Boolean(signature) &&
        crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {}
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
    const payment = data.providerTxnRef
      ? [...state.payments.values()].find(
          (item) => item.providerTxnRef === data.providerTxnRef,
        )
      : null;
    if (!payment) return error(response, 404, "NOT_FOUND", "payment not found");
    if (Number(data.amountVnd) !== payment.amountVnd)
      return error(response, 422, "AMOUNT_MISMATCH", "payment amount mismatch");
    if (!["SUCCESS", "FAILED"].includes(data.status))
      return error(response, 400, "INVALID_ARGUMENT", "invalid payment status");
    if (data.status === "SUCCESS") await markTripPaid(payment);
    else if (payment.status !== "COMPLETED") {
      payment.status = "FAILED";
      payment.failedReason = data.reason ?? "SANDBOX_FAILED";
      payment.updatedAt = new Date().toISOString();
    }
    return response.json({ result: payment.status, paymentId: payment.paymentId });
  });

  app.post("/payments/:id/sandbox-confirm", async (request, response) => {
    const user = requireUser(request, response, ["CUSTOMER"]);
    if (!user || !idempotent(request, response, "sandbox-confirm")) return;
    const payment = state.payments.get(request.params.id);
    if (!payment) return error(response, 404, "NOT_FOUND", "payment not found");
    if (payment.customerId !== user.profileId)
      return error(response, 403, "FORBIDDEN", "payment owner required");
    if (!["SUCCESS", "FAILED"].includes(request.body.scenario))
      return error(
        response,
        400,
        "INVALID_ARGUMENT",
        "scenario must be SUCCESS or FAILED",
      );
    if (request.body.scenario === "SUCCESS") await markTripPaid(payment);
    else if (payment.status !== "COMPLETED") {
      payment.status = "FAILED";
      payment.failedReason = "SANDBOX_FAILED";
      payment.updatedAt = new Date().toISOString();
    }
    const result = { result: payment.status, paymentId: payment.paymentId };
    saveIdempotency(request, "sandbox-confirm", 200, result);
    return response.json(result);
  });
}
