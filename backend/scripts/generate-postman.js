import fs from "node:fs";
const item = [];
function add(name, method, path, body, role, expected = 200, save = {}, extra = [], key, pre = []) {
  const header = [{ key: "Content-Type", value: "application/json" }];
  if (role) header.push({ key: "Authorization", value: `Bearer {{${role}Token}}` });
  if (key) header.push({ key: "Idempotency-Key", value: `{{runId}}-${key}` });
  const tests = [`pm.test(${JSON.stringify(name + " status")}, () => pm.response.to.have.status(${expected}));`, "const data = pm.response.json();"];
  for (const [variable, expression] of Object.entries(save)) tests.push(`pm.collectionVariables.set(${JSON.stringify(variable)}, ${expression});`);
  tests.push(...extra);
  tests.unshift("{");
  tests.push("}");
  const request = { method, header, url: `{{baseUrl}}${path}`, description: name };
  if (body !== undefined) request.body = { mode: "raw", raw: typeof body === "string" ? body : JSON.stringify(body, null, 2), options: { raw: { language: "json" } } };
  const entry = { name, request, event: [{ listen: "test", script: { type: "text/javascript", exec: tests } }] };
  if (pre.length) entry.event.unshift({ listen: "prerequest", script: { type: "text/javascript", exec: pre } });
  item.push(entry);
  return entry;
}
add("PC6 Health", "GET", "/health", undefined, null, 200, {}, [], null, ['pm.collectionVariables.set("runId", Date.now().toString());']);
add("Endpoint catalog", "GET", "/endpoints", undefined, null, 200, {}, ['pm.test("7 service catalogs", () => pm.expect(Object.keys(data.services)).to.have.length(7));', 'pm.test("driver routes visible", () => pm.expect(data.services["driver-service"].some(x => x.path === "/drivers/nearby")).to.eql(true));']);
add("PC6 Ready", "GET", "/ready");
add("PC6 Services", "GET", "/health/services", undefined, null, 200, {}, ['pm.test("7 services", () => pm.expect(data.services).to.have.length(7));']);
add("PC8 Internal routes blocked", "GET", "/internal/accounts/drivers", undefined, null, 404);
for (const [role, email, password] of [["customer", "customer@cab.local", "Customer123!"], ["driver", "driver@cab.local", "Driver123!"], ["admin", "admin@cab.local", "Admin123!"]]) add(`PC10 Login ${role}`, "POST", "/auth/login", { email, password }, null, 200, { [`${role}Token`]: "data.accessToken" });
add("PC9 Register customer", "POST", "/auth/register", { fullName: "<script>alert('hack')</script>", email: "postman-{{runId}}@cab.local", phone: "+849{{runId}}", password: "Customer123!" }, null, 201, { customerId: "data.customerId" }, [], "register");
add("PC10 Login new customer", "POST", "/auth/login", { email: "postman-{{runId}}@cab.local", password: "Customer123!" }, null, 200, { newCustomerToken: "data.accessToken" });
add("PC11/PC26 Customer profile", "GET", "/customers/{{customerId}}", undefined, "newCustomer", 200, {}, ['pm.test("XSS escaped", () => pm.expect(data.fullName).not.to.include("<script>"));']);
add("PC12 Driver profile", "GET", "/drivers/20000000-0000-4000-8000-000000000001", undefined, "customer");
add("PC13 Nearby 1km paging", "GET", "/drivers/nearby?lat=10.7735&lng=106.699&radius=1000&page=1&limit=2", undefined, "customer", 200, {}, ['pm.test("radius and limit", () => { pm.expect(data.items.length).to.be.at.most(2); data.items.forEach(x => pm.expect(x.distanceM).to.be.at.most(1000)); });']);
add("PC14 Booking history paging", "GET", "/bookings?page=2&limit=2", undefined, "customer", 200, {}, ['pm.test("5 seeded bookings and page 2", () => { pm.expect(data.total).to.be.at.least(5); pm.expect(data.items).to.have.length(2); pm.expect(data.page).to.eql(2); });']);
const booking = { pickup: { lat: 10.7735, lng: 106.699 }, dropoff: { lat: 10.78, lng: 106.71 }, vehicleType: "BIKE" };
add("PC15 Create booking", "POST", "/bookings", booking, "newCustomer", 201, { bookingId: "data.bookingId" }, ['pm.test("searching", () => pm.expect(data.status).to.eql("SEARCHING"));'], "booking");
add("PC30 Replay booking", "POST", "/bookings", booking, "newCustomer", 201, {}, ['pm.test("same booking", () => pm.expect(data.bookingId).to.eql(pm.collectionVariables.get("bookingId")));'], "booking");
add("PC16 Driver offers", "GET", "/offers", undefined, "driver", 200, { offerId: 'data.items.find(x => x.bookingId === pm.collectionVariables.get("bookingId")).id' });
add("PC16 Offer detail", "GET", "/offers/{{offerId}}", undefined, "driver");
add("PC16 Accept offer", "POST", "/offers/{{offerId}}/accept", {}, "driver", 200, { tripId: "data.tripId" }, [], "accept");
add("PC16 Customer notification", "GET", "/notifications", undefined, "newCustomer", 200, {}, ['pm.test("assigned notification", () => pm.expect(data.items.some(x => x.type === "DRIVER_ASSIGNED")).to.eql(true));']);
add("PC17 Reject skipped transition", "PATCH", "/trips/{{tripId}}/status", { status: "COMPLETED" }, "driver", 409);
for (const status of ["ARRIVED", "IN_PROGRESS"]) add(`PC17 ${status}`, "PATCH", "/trips/{{tripId}}/status", { status }, "driver");
add("PC17 Trip location", "PUT", "/trips/{{tripId}}/location", { lat: 10.777, lng: 106.705 }, "driver");
add("PC17 COMPLETED", "PATCH", "/trips/{{tripId}}/status", { status: "COMPLETED" }, "driver");
const payment = { tripId: "{{tripId}}", method: "ONLINE" };
add("PC19 Online payment", "POST", "/payments", payment, "newCustomer", 201, { paymentId: "data.paymentId", amountVnd: "data.amountVnd" }, [], "payment");
add("PC30 Replay payment", "POST", "/payments", payment, "newCustomer", 201, {}, ['pm.test("same payment", () => pm.expect(data.paymentId).to.eql(pm.collectionVariables.get("paymentId")));'], "payment");
add("PC19 Payment detail", "GET", "/payments/{{paymentId}}", undefined, "newCustomer", 200, { providerTxnRef: "data.providerTxnRef" });
const callback = add("PC19 Signed callback", "POST", "/payments/callback", '{"providerTxnRef":"{{providerTxnRef}}","amountVnd":{{amountVnd}},"status":"SUCCESS"}', null, 200, {}, [], null, [
  'const raw = pm.variables.replaceIn(pm.request.body.raw);',
  'const timestamp = Math.floor(Date.now()/1000).toString();',
  'const signature = require("crypto-js").HmacSHA256(timestamp + "." + raw, pm.environment.get("paymentCallbackSecret")).toString();',
  'pm.request.headers.upsert({ key: "X-Timestamp", value: timestamp });',
  'pm.request.headers.upsert({ key: "X-Signature", value: signature });',
]);
item.push({ ...structuredClone(callback), name: "PC30 Duplicate callback" });
add("PC19 Trip paid", "GET", "/trips/{{tripId}}", undefined, "newCustomer", 200, {}, ['pm.test("paid", () => pm.expect(data.paymentStatus).to.eql("PAID"));']);
add("PC20/PC26 Review", "POST", "/trips/{{tripId}}/reviews", { stars: 5, comment: "<script>alert('hack')</script>" }, "newCustomer", 201, {}, ['pm.test("review linked and escaped", () => { pm.expect(data.tripId).to.eql(pm.collectionVariables.get("tripId")); pm.expect(data.comment).not.to.include("<script>"); });'], "review");
add("PC18 New booking for cancellation", "POST", "/bookings", booking, "newCustomer", 201, { cancelBookingId: "data.bookingId" }, [], "cancel-booking");
add("PC18 Find cancellation offer", "GET", "/offers", undefined, "driver", 200, { cancelOfferId: 'data.items.find(x => x.bookingId === pm.collectionVariables.get("cancelBookingId")).id' });
add("PC18 Assign cancellation trip", "POST", "/offers/{{cancelOfferId}}/accept", {}, "driver", 200, { cancelTripId: "data.tripId" }, [], "cancel-accept");
add("PC18 Cancel trip with reason", "POST", "/trips/{{cancelTripId}}/cancel", { reason: "Thay đổi kế hoạch" }, "newCustomer", 200, {}, ['pm.test("canceled", () => pm.expect(data.status).to.eql("CANCELED"));']);
add("PC18 Cancellation notification", "GET", "/notifications", undefined, "driver", 200, {}, ['pm.test("driver notified", () => pm.expect(data.items.some(x => x.type === "TRIP_CANCELED" && x.resourceId === pm.collectionVariables.get("cancelTripId"))).to.eql(true));']);
add("PC21 Request OTP", "POST", "/drivers/otp/request", { phone: "+848{{runId}}" }, null, 202, { challengeId: "data.challengeId" });
add("PC21 Verify OTP", "POST", "/drivers/otp/verify", { phone: "+848{{runId}}", challengeId: "{{challengeId}}", code: "123456" }, null, 200, { registrationToken: "data.registrationToken" });
add("PC21 Register driver", "POST", "/drivers/register", { phone: "+848{{runId}}", email: "driver-{{runId}}@cab.local", fullName: "Postman Driver", password: "Driver123!", vehicleType: "BIKE", plate: "59A-12345", citizenId: "012345678901", licenseNumber: "GPLX-123" }, "registration", 201, { driverId: "data.driverId" }, ['pm.test("pending approval", () => pm.expect(data.status).to.eql("PENDING_APPROVAL"));'], "driver-register");
add("PC22 Pending applications", "GET", "/admin/drivers?status=PENDING_APPROVAL", undefined, "admin");
add("PC22 Application detail", "GET", "/admin/drivers/{{driverId}}", undefined, "admin");
add("PC22 Approve driver", "POST", "/admin/drivers/{{driverId}}/approve", {}, "admin");
add("PC22 Approved driver login", "POST", "/auth/login", { email: "driver-{{runId}}@cab.local", password: "Driver123!" }, null, 200, { newDriverToken: "data.accessToken" }, ['pm.test("account active", () => pm.expect(data.accountStatus).to.eql("ACTIVE"));']);
for (const status of ["ONLINE", "OFFLINE"]) add(`PC23 Driver ${status}`, "PUT", "/drivers/me/availability", { status }, "newDriver");
add("PC25 SQL injection", "POST", "/auth/login", { email: "' OR 1=1 --", password: "anything" }, null, 401);
add("PC27 Tampered JWT", "GET", "/customers/{{customerId}}", undefined, "tampered", 401, {}, [], null, ['const token = pm.collectionVariables.get("newCustomerToken"); pm.collectionVariables.set("tamperedToken", token.slice(0, -8) + "xxxxxxxx");']);
add("PC28 Customer cannot use driver API", "PUT", "/drivers/me/availability", { status: "ONLINE" }, "newCustomer", 403);
// This customer made three bookings + a replay: the fifth call is accepted
// by the limiter and rejected by validation; the sixth is rate limited.
add("PC29 Booking request 5", "POST", "/bookings", {}, "newCustomer", 400, {}, [], "rate-5");
add("PC29 Booking request 6", "POST", "/bookings", {}, "newCustomer", 400, {}, [], "rate-6");
add("PC29 Rate limited", "POST", "/bookings", {}, "newCustomer", 429);
const collection = { info: { name: "CAB System - phieucham PC6-PC30", schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json", description: "Run sequentially on local seeded stack. PC24: inspect DB using document/database-and-postman.md. Wait 60 seconds between runs. Set paymentCallbackSecret in the local Postman environment." }, variable: [{ key: "baseUrl", value: "http://localhost:8000" }], item };
fs.mkdirSync("postman", { recursive: true });
fs.writeFileSync("postman/CAB-phieucham.postman_collection.json", JSON.stringify(collection, null, 2) + "\n");
fs.writeFileSync("postman/CAB-local.postman_environment.json", JSON.stringify({ name: "CAB local", values: [{ key: "paymentCallbackSecret", value: "", type: "secret", enabled: true }], _postman_variable_scope: "environment" }, null, 2) + "\n");
console.log(`Generated ${item.length} Postman requests`);
