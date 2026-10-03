const baseUrl = process.env.GATEWAY_URL ?? "http://localhost:8000";
const unique = Date.now();
const checks = [];
try {
  const health = await fetch(`${baseUrl}/health`);
  if (!health.ok) throw new Error(`HTTP ${health.status}`);
} catch (error) {
  console.error(
    `REQUIRES_DOCKER: Gateway is unavailable at ${baseUrl} (${error.message}). Start Docker Compose or set GATEWAY_URL to a running Gateway.`,
  );
  process.exitCode = 2;
  process.exit();
}
async function request(method, path, body, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }
  return { response, payload };
}
function expect(label, actual, expected) {
  if (actual !== expected)
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  checks.push(`${label}: ${actual}`);
}
async function login(identifier, password) {
  const body = identifier.includes("@")
    ? { email: identifier, password }
    : { phone: identifier, password };
  const result = await request("POST", "/auth/login", body);
  expect(`login ${identifier}`, result.response.status, 200);
  return result.payload.accessToken;
}
const health = await request("GET", "/health");
expect("health", health.response.status, 200);
const customerToken = await login("customer@cab.local", "Customer123!");
const driverToken = await login("driver@cab.local", "Driver123!");
const adminToken = await login("admin@cab.local", "Admin123!");
const registration = await request(
  "POST",
  "/auth/register",
  {
    fullName: "Smoke User",
    email: `smoke${unique}@cab.local`,
    phone: `+8490${String(unique).slice(-8)}`,
    password: "Customer123!",
  },
  { "Idempotency-Key": `register-${unique}` },
);
expect("PC9 register", registration.response.status, 201);
const registeredToken = await login(`smoke${unique}@cab.local`, "Customer123!");
const profile = await request(
  "GET",
  `/customers/${registration.payload.customerId}`,
  undefined,
  { Authorization: `Bearer ${registeredToken}` },
);
expect("PC11 profile", profile.response.status, 200);
const nearby = await request(
  "GET",
  "/drivers/nearby?lat=10.7735&lng=106.699&radius=1000&page=1&limit=2",
  undefined,
  { Authorization: `Bearer ${customerToken}` },
);
expect("PC13 nearby", nearby.response.status, 200);
const estimate = await request(
  "POST",
  "/fare-estimates",
  {
    pickup: { lat: 10.7735, lng: 106.699 },
    dropoff: { lat: 10.78, lng: 106.71 },
    vehicleType: "BIKE",
  },
  { Authorization: `Bearer ${customerToken}` },
);
expect("fare estimate", estimate.response.status, 200);
const bookingBody = {
  pickup: { lat: 10.7735, lng: 106.699 },
  dropoff: { lat: 10.78, lng: 106.71 },
  vehicleType: "BIKE",
};
const booking = await request("POST", "/bookings", bookingBody, {
  Authorization: `Bearer ${customerToken}`,
  "Idempotency-Key": `booking-${unique}`,
});
expect("PC15 booking", booking.response.status, 201);
const bookingReplay = await request("POST", "/bookings", bookingBody, {
  Authorization: `Bearer ${customerToken}`,
  "Idempotency-Key": `booking-${unique}`,
});
expect("PC30 booking replay", bookingReplay.response.status, 201);
if (bookingReplay.payload.bookingId !== booking.payload.bookingId)
  throw new Error("booking replay created a different booking");
const offers = await request("GET", "/offers", undefined, {
  Authorization: `Bearer ${driverToken}`,
});
expect("PC16 offers", offers.response.status, 200);
if (!offers.payload.items?.length)
  throw new Error("dispatch did not create an offer");
const accepted = await request(
  "POST",
  `/offers/${offers.payload.items.find(item => item.bookingId === booking.payload.bookingId).id}/accept`,
  {},
  {
    Authorization: `Bearer ${driverToken}`,
    "Idempotency-Key": `accept-${unique}`,
  },
);
expect("PC16 accept", accepted.response.status, 200);
const tripId = accepted.payload.tripId;
for (const status of ["ARRIVED", "IN_PROGRESS", "COMPLETED"]) {
  const result = await request(
    "PATCH",
    `/trips/${tripId}/status`,
    { status },
    { Authorization: `Bearer ${driverToken}` },
  );
  expect(`PC17 ${status}`, result.response.status, 200);
}
const payment = await request(
  "POST",
  "/payments",
  { tripId, method: "ONLINE" },
  {
    Authorization: `Bearer ${customerToken}`,
    "Idempotency-Key": `payment-${unique}`,
  },
);
expect("PC19 payment", payment.response.status, 201);
const confirmed = await request(
  "POST",
  `/payments/${payment.payload.paymentId}/sandbox-confirm`,
  { scenario: "SUCCESS" },
  {
    Authorization: `Bearer ${customerToken}`,
    "Idempotency-Key": `confirm-${unique}`,
  },
);
expect("PC19 sandbox callback", confirmed.response.status, 200);
const review = await request(
  "POST",
  `/trips/${tripId}/reviews`,
  { stars: 5, comment: "<script>alert('x')</script>" },
  {
    Authorization: `Bearer ${customerToken}`,
    "Idempotency-Key": `review-${unique}`,
  },
);
expect("PC20 review", review.response.status, 201);
if (review.payload.comment.includes("<script>"))
  throw new Error("XSS was not escaped");
const badJwt = await request(
  "GET",
  `/customers/${registration.payload.customerId}`,
  undefined,
  { Authorization: `Bearer ${customerToken.slice(0, -2)}xx` },
);
expect("PC27 tampered JWT", badJwt.response.status, 401);
const forbidden = await request(
  "PUT",
  "/drivers/me/availability",
  { status: "ONLINE" },
  { Authorization: `Bearer ${customerToken}` },
);
expect("PC28 customer driver command", forbidden.response.status, 403);
const injection = await request("POST", "/auth/login", {
  email: "' OR 1=1 --",
  password: "anything",
});
expect("PC25 SQL injection", injection.response.status, 401);
const missingKey = await request("POST", "/bookings", bookingBody, {
  Authorization: `Bearer ${customerToken}`,
});
expect("PC30 missing key", missingKey.response.status, 400);
for (const route of ["/health", "/ready", "/health/services"]) {
  const result = await request("GET", route);
  expect(route, result.response.status, 200);
}
console.log(
  `PASS ${checks.length} Gateway checks; admin token ready for PC22: ${Boolean(adminToken)}`,
);
