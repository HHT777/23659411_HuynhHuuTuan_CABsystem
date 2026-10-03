import crypto from "node:crypto";
import fs from "node:fs";

const base = process.env.GATEWAY_URL ?? "http://localhost:8000";
const runId = Date.now();
let failures = 0;

function safe(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text
    .replace(/"accessToken":"[^"]+"/g, '"accessToken":"[REDACTED]"')
    .replace(/"registrationToken":"[^"]+"/g, '"registrationToken":"[REDACTED]"')
    .slice(0, 360);
}

function check(pc, label, actual, expected, payload = {}) {
  const accepted = Array.isArray(expected) ? expected : [expected];
  const ok = accepted.includes(actual);
  if (!ok) failures += 1;
  console.log(
    `CHECK|${pc}|${ok ? "PASS" : "FAIL"}|${label}|expected=${accepted.join("/")}|actual=${actual}|${safe(payload)}`,
  );
  return ok;
}

async function req(method, path, body, headers = {}, raw = false) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body:
      body === undefined
        ? undefined
        : raw
          ? body
          : JSON.stringify(body),
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }
  return { status: response.status, headers: response.headers, payload, text };
}

async function login(email, password) {
  return req("POST", "/auth/login", { email, password });
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

function decodePart(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function envValue(name) {
  const line = fs
    .readFileSync(new URL("../../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .find((item) => item.startsWith(`${name}=`));
  return line?.slice(name.length + 1) ?? (name === "PAYMENT_CALLBACK_SECRET" ? "cab-local-callback-secret" : "");
}

const health = await req("GET", "/health", undefined, { "X-Request-ID": "audit-fixed-id" });
check("PC3", "health status", health.status, 200, health.payload);
check("PC3", "X-Request-ID response header", health.headers.get("x-request-id"), "audit-fixed-id", {});
const internal = await req("GET", "/internal/health");
check("PC3/PC8", "Gateway blocks /internal/*", internal.status, 404, internal.payload);

const customerLogin = await login("customer@cab.local", "Customer123!");
const driverLogin = await login("driver@cab.local", "Driver123!");
const adminLogin = await login("admin@cab.local", "Admin123!");
check("PC10", "customer login", customerLogin.status, 200, customerLogin.payload);
check("PC10", "driver login", driverLogin.status, 200, driverLogin.payload);
check("PC10", "admin login", adminLogin.status, 200, adminLogin.payload);
const customerToken = customerLogin.payload.accessToken;
const driverToken = driverLogin.payload.accessToken;
const adminToken = adminLogin.payload.accessToken;
const jwtHeader = decodePart(customerToken.split(".")[0]);
check("PC10", "JWT alg", jwtHeader.alg, "RS256", jwtHeader);
let result = await login("customer@cab.local", "wrong-password");
check("PC10", "wrong password", result.status, 401, result.payload);
result = await req("POST", "/auth/login", { email: "customer@cab.local" });
check("PC10", "missing password", result.status, 401, result.payload);

const mainEmail = `audit-main-${runId}@cab.local`;
const mainPhone = `+848${String(runId).slice(-8)}`;
const registrationBody = {
  fullName: "<script>alert(1)</script>",
  email: mainEmail,
  phone: mainPhone,
  password: "Audit123!",
};
const registrationKey = `register-${runId}`;
const registration = await req("POST", "/auth/register", registrationBody, {
  "Idempotency-Key": registrationKey,
});
check("PC9", "customer register", registration.status, 201, registration.payload);
result = await req("POST", "/auth/register", { email: "missing@cab.local" }, {
  "Idempotency-Key": `register-missing-${runId}`,
});
check("PC9", "register missing fields", result.status, 400, result.payload);
result = await req("POST", "/auth/register", registrationBody, {
  "Idempotency-Key": `register-duplicate-${runId}`,
});
check("PC9", "register duplicate", result.status, 409, result.payload);
const mainLogin = await login(mainEmail, "Audit123!");
check("PC9/PC10", "new customer login", mainLogin.status, 200, mainLogin.payload);
const mainToken = mainLogin.payload.accessToken;

result = await req("GET", `/customers/${registration.payload.customerId}`, undefined, bearer(mainToken));
check("PC11/PC26", "owner profile and escaped name", result.status, 200, result.payload);
check("PC26", "profile has no literal script tag", result.text.includes("<script>"), false, result.payload);
result = await req("GET", `/customers/${registration.payload.customerId}`, undefined, bearer(customerToken));
check("PC11/PC28", "customer IDOR", result.status, 403, result.payload);
result = await req("GET", "/customers/00000000-0000-4000-8000-000000000000", undefined, bearer(adminToken));
check("PC11", "customer not found", result.status, 404, result.payload);
result = await req("GET", `/customers/${registration.payload.customerId}`);
check("PC11/PC28", "customer without token", result.status, 401, result.payload);

result = await req("GET", "/drivers/20000000-0000-4000-8000-000000000001", undefined, bearer(customerToken));
check("PC12", "public driver", result.status, 200, result.payload);
check("PC12", "public driver does not expose documents", Boolean(result.payload.citizenId || result.payload.licenseNumber || result.payload.phone), false, result.payload);
result = await req("GET", "/drivers/00000000-0000-4000-8000-000000000000", undefined, bearer(customerToken));
check("PC12", "driver not found", result.status, 404, result.payload);
result = await req("GET", "/drivers/20000000-0000-4000-8000-000000000001");
check("PC12/PC28", "driver without token", result.status, 401, result.payload);

result = await req("GET", "/drivers/nearby?lat=10.7735&lng=106.699&radius=1000&page=1&limit=2", undefined, bearer(customerToken));
check("PC13", "nearby paging", result.status, 200, result.payload);
result = await req("GET", "/drivers/nearby?lat=bad&lng=bad&radius=-1", undefined, bearer(customerToken));
check("PC13", "nearby invalid coordinates", result.status, 400, result.payload);

result = await req("GET", "/bookings?page=1&limit=2", undefined, bearer(mainToken));
check("PC14", "booking list paging", result.status, 200, result.payload);
result = await req("GET", "/bookings/not-found", undefined, bearer(mainToken));
check("PC14", "booking not found", result.status, 404, result.payload);
result = await req("GET", "/bookings/not-found");
check("PC14/PC28", "booking without token", result.status, 401, result.payload);

const bookingBody = {
  pickup: { lat: 10.7735, lng: 106.699, address: "<img src=x onerror=alert(1)>" },
  dropoff: { lat: 10.78, lng: 106.71, address: "B" },
  vehicleType: "BIKE",
};
const bookingKey = `booking-${runId}`;
const booking = await req("POST", "/bookings", bookingBody, {
  ...bearer(mainToken),
  "Idempotency-Key": bookingKey,
});
check("PC15", "create booking", booking.status, 201, booking.payload);
result = await req("POST", "/bookings", { vehicleType: "BIKE" }, {
  ...bearer(customerToken),
  "Idempotency-Key": `booking-missing-${runId}`,
});
check("PC15", "booking missing fields", result.status, 400, result.payload);
result = await req("POST", "/bookings/not-found", bookingBody, {
  ...bearer(driverToken),
  "Idempotency-Key": `booking-role-${runId}`,
});
check("PC15/PC28", "driver cannot create booking", result.status, 403, result.payload);

const bookingReplay = await req("POST", "/bookings", bookingBody, {
  ...bearer(mainToken),
  "Idempotency-Key": bookingKey,
});
check("PC30", "booking replay status", bookingReplay.status, 201, bookingReplay.payload);
check("PC30", "booking replay same id", bookingReplay.payload.bookingId, booking.payload.bookingId, bookingReplay.payload);
result = await req("POST", "/bookings", { ...bookingBody, vehicleType: "SEDAN" }, {
  ...bearer(mainToken),
  "Idempotency-Key": bookingKey,
});
check("PC30", "same key changed body", result.status, 422, result.payload);

const cancelBooking = await req("POST", "/bookings/", bookingBody, {
  ...bearer(customerToken),
  "Idempotency-Key": `booking-cancel-flow-${runId}`,
});
check("PC18", "create cancelable booking", cancelBooking.status, 201, cancelBooking.payload);
if (cancelBooking.payload.bookingId) {
  result = await req("POST", `/bookings/${cancelBooking.payload.bookingId}/cancel`, {}, {
    ...bearer(customerToken), "Idempotency-Key": `cancel-missing-${runId}`,
  });
  check("PC18", "booking cancel missing reason", result.status, 400, result.payload);
  result = await req("POST", `/bookings/${cancelBooking.payload.bookingId}/cancel`, { reason: "changed plans" }, {
    ...bearer(customerToken), "Idempotency-Key": `cancel-valid-${runId}`,
  });
  check("PC18", "booking cancel valid", result.status, 200, result.payload);
}

const offers = await req("GET", "/offers", undefined, bearer(driverToken));
check("PC16", "driver offers", offers.status, 200, offers.payload);
const offerId = offers.payload.items?.find((item) => item.bookingId === booking.payload.bookingId)?.id;
if (!offerId) {
  check("PC15/PC16", "offer dispatched", "missing", "present", offers.payload);
} else {
  result = await req("POST", "/offers/not-found/accept", {}, {
    ...bearer(driverToken),
    "Idempotency-Key": `accept-missing-${runId}`,
  });
  check("PC16", "offer not found", result.status, 404, result.payload);
  result = await req("POST", `/offers/${offerId}/accept`, {}, {
    ...bearer(customerToken),
    "Idempotency-Key": `accept-role-${runId}`,
  });
  check("PC16/PC28", "customer cannot accept", result.status, 403, result.payload);
}
const accepted = offerId
  ? await req("POST", `/offers/${offerId}/accept`, {}, {
      ...bearer(driverToken),
      "Idempotency-Key": `accept-${runId}`,
    })
  : { status: 0, payload: {} };
check("PC16", "accept offer", accepted.status, 200, accepted.payload);
const tripId = accepted.payload.tripId;

if (tripId) {
  result = await req("PATCH", `/trips/${tripId}/status`, { status: "COMPLETED" }, bearer(driverToken));
  check("PC17", "invalid transition", result.status, 409, result.payload);
  result = await req("PATCH", "/trips/not-found/status", { status: "ARRIVED" }, bearer(driverToken));
  check("PC17", "trip not found", result.status, 404, result.payload);
  result = await req("PATCH", `/trips/${tripId}/status`, { status: "ARRIVED" }, bearer(customerToken));
  check("PC17/PC28", "customer cannot change trip", result.status, 403, result.payload);
  result = await req("POST", `/trips/${tripId}/cancel`, {}, bearer(mainToken));
  check("PC18", "cancel missing reason", result.status, 400, result.payload);
  for (const status of ["ARRIVED", "IN_PROGRESS", "COMPLETED"]) {
    result = await req("PATCH", `/trips/${tripId}/status`, { status }, bearer(driverToken));
    check("PC17", `transition ${status}`, result.status, 200, result.payload);
  }
}

const payment = tripId
  ? await req("POST", "/payments", { tripId, method: "ONLINE" }, {
      ...bearer(mainToken),
      "Idempotency-Key": `payment-${runId}`,
    })
  : { status: 0, payload: {} };
check("PC19", "create online payment", payment.status, 201, payment.payload);
result = await req("POST", "/payments", { tripId, method: "CASH" }, {
  ...bearer(mainToken),
  "Idempotency-Key": `payment-bad-${runId}`,
});
check("PC19", "reject non-online payment", result.status, 400, result.payload);
if (payment.payload.paymentId) {
  const paymentDetail = await req("GET", `/payments/${payment.payload.paymentId}`, undefined, bearer(mainToken));
  const callbackData = {
    providerTxnRef: paymentDetail.payload.providerTxnRef,
    amountVnd: paymentDetail.payload.amountVnd,
    status: "SUCCESS",
  };
  const raw = JSON.stringify(callbackData);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  result = await req("POST", "/payments/callback", raw, { "X-Timestamp": timestamp }, true);
  check("PC19", "callback missing signature", result.status, 401, result.payload);
  result = await req("POST", "/payments/callback", raw, { "X-Timestamp": timestamp, "X-Signature": "bad" }, true);
  check("PC19", "callback bad signature", result.status, 401, result.payload);
  const signature = crypto.createHmac("sha256", envValue("PAYMENT_CALLBACK_SECRET"))
    .update(`${timestamp}.`).update(Buffer.from(raw)).digest("hex");
  result = await req("POST", "/payments/callback", raw, { "X-Timestamp": timestamp, "X-Signature": signature }, true);
  check("PC19", "callback valid raw-body HMAC", result.status, 200, result.payload);
  const duplicate = await req("POST", "/payments/callback", raw, { "X-Timestamp": timestamp, "X-Signature": signature }, true);
  check("PC30", "duplicate callback", duplicate.status, 200, duplicate.payload);
}

if (tripId) {
  const reviewKey = `review-${runId}`;
  const review = await req("POST", `/trips/${tripId}/reviews`, {
    stars: 5,
    comment: "<img src=x onerror=alert(1)>",
  }, { ...bearer(mainToken), "Idempotency-Key": reviewKey });
  check("PC20/PC26", "review and XSS escaping", review.status, 201, review.payload);
  check("PC26", "review has no literal img tag", review.text.includes("<img"), false, review.payload);
  result = await req("POST", `/trips/${tripId}/reviews`, { stars: 9 }, {
    ...bearer(mainToken), "Idempotency-Key": `review-invalid-${runId}`,
  });
  check("PC20", "invalid stars", result.status, 400, result.payload);
  result = await req("POST", `/trips/${tripId}/reviews`, { stars: 5 }, {
    ...bearer(customerToken), "Idempotency-Key": `review-owner-${runId}`,
  });
  check("PC20/PC28", "review wrong owner", result.status, 403, result.payload);
}

const otpPhone = `+847${String(runId).slice(-8)}`;
const otp = await req("POST", "/drivers/otp/request", { phone: otpPhone });
check("PC21", "OTP request", otp.status, 202, otp.payload);
result = await req("POST", "/drivers/otp/verify", { phone: otpPhone, challengeId: otp.payload.challengeId, code: "000000" });
check("PC21", "OTP invalid", result.status, 422, result.payload);
const verified = await req("POST", "/drivers/otp/verify", { phone: otpPhone, challengeId: otp.payload.challengeId, code: "123456" });
check("PC21", "OTP verify", verified.status, 200, verified.payload);
const newDriverEmail = `audit-driver-${runId}@cab.local`;
const driverRegistration = await req("POST", "/drivers/register", {
  fullName: "Audit Driver",
  phone: otpPhone,
  email: newDriverEmail,
  password: "Driver123!",
  vehicleType: "BIKE",
  plate: "51A-12345",
  citizenId: "012345678901",
  licenseNumber: "GPLX-123",
}, {
  Authorization: `Bearer ${verified.payload.registrationToken}`,
  "Idempotency-Key": `driver-register-${runId}`,
});
check("PC21", "driver register", driverRegistration.status, 201, driverRegistration.payload);
result = await req("POST", "/drivers/register", {}, { "Idempotency-Key": `driver-empty-${runId}` });
check("PC21", "driver register without OTP proof", result.status, 401, result.payload);
const emptyDriverId = result.payload.driverId;

result = await req("POST", `/admin/drivers/${driverRegistration.payload.driverId}/approve`, {}, bearer(customerToken));
check("PC22/PC28", "customer cannot approve", result.status, 403, result.payload);
result = await req("POST", "/admin/drivers/not-found/approve", {}, bearer(adminToken));
check("PC22", "approve not found", result.status, 404, result.payload);
const approved = await req("POST", `/admin/drivers/${driverRegistration.payload.driverId}/approve`, {}, bearer(adminToken));
check("PC22", "admin approve", approved.status, 200, approved.payload);
if (emptyDriverId) {
  result = await req("POST", `/admin/drivers/${emptyDriverId}/reject`, {}, bearer(adminToken));
  check("PC22", "reject missing reason", result.status, 400, result.payload);
  result = await req("POST", `/admin/drivers/${emptyDriverId}/reject`, { reason: "incomplete" }, bearer(adminToken));
  check("PC22", "admin reject", result.status, 200, result.payload);
}
const newDriverLogin = await login(newDriverEmail, "Driver123!");
check("PC21/PC22", "approved driver login", newDriverLogin.status, 200, newDriverLogin.payload);
const newDriverToken = newDriverLogin.payload.accessToken;
result = await req("PUT", "/drivers/me/availability", { status: "ONLINE" }, bearer(newDriverToken));
check("PC23", "driver online", result.status, 200, result.payload);
result = await req("PUT", "/drivers/me/location", { lat: 10.77, lng: 106.7 }, bearer(newDriverToken));
check("PC23", "driver location", result.status, 200, result.payload);
result = await req("PUT", "/drivers/me/availability", { status: "OFFLINE" }, bearer(newDriverToken));
check("PC23", "driver offline", result.status, 200, result.payload);
result = await req("PUT", "/drivers/me/availability", { status: "INVALID" }, bearer(newDriverToken));
check("PC23", "invalid availability", result.status, 400, result.payload);
result = await req("PUT", "/drivers/me/availability", { status: "ONLINE" }, bearer(customerToken));
check("PC23/PC28", "customer cannot set availability", result.status, 403, result.payload);

for (const injection of ["' OR '1'='1", "'; DROP TABLE users;--", '" OR ""="']) {
  result = await req("POST", "/auth/login", { email: injection, password: injection });
  check("PC25", `SQLi ${injection}`, result.status, 401, result.payload);
}

const [head, payload, signature] = customerToken.split(".");
const originalClaims = decodePart(payload);
const tampered = `${head}.${Buffer.from(JSON.stringify({ ...originalClaims, role: "ADMIN" })).toString("base64url")}.${signature}`;
const none = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${payload}.`;
const hsHead = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
const hsUnsigned = `${hsHead}.${payload}`;
const publicKey = fs.readFileSync(new URL("../../.secrets/jwt-public.pem", import.meta.url));
const hs = `${hsUnsigned}.${crypto.createHmac("sha256", publicKey).update(hsUnsigned).digest("base64url")}`;
const expiredPayload = Buffer.from(JSON.stringify({ ...originalClaims, exp: 1 })).toString("base64url");
const expiredUnsigned = `${head}.${expiredPayload}`;
const privateKey = fs.readFileSync(new URL("../../.secrets/jwt-private.pem", import.meta.url));
const expired = `${expiredUnsigned}.${crypto.sign("RSA-SHA256", Buffer.from(expiredUnsigned), privateKey).toString("base64url")}`;
for (const [label, token] of [["tampered payload", tampered], ["alg none", none], ["HS256 confusion", hs], ["missing signature", `${head}.${payload}.`], ["expired", expired]]) {
  result = await req("GET", "/customers/10000000-0000-4000-8000-000000000001", undefined, bearer(token));
  check("PC27", label, result.status, 401, result.payload);
}

console.log(`SUMMARY|checks_failed=${failures}`);
process.exitCode = failures ? 1 : 0;
