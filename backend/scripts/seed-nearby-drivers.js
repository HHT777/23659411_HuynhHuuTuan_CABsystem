// Run from the repository root: node backend/scripts/seed-nearby-drivers.js
// Sandbox fixture for testing the 3 km nearby radius around the sample pickup.
const baseUrl = process.env.GATEWAY_URL ?? "http://localhost:8000/api/v1";
const center = { lat: 10.7735, lng: 106.699 };
const password = "Driver123!";
const fixtures = [
  { name: "Nearby 2 km Bike", email: "nearby-2km-bike@cab.local", phone: "+84909003001", plate: "TEST-3001", vehicleType: "BIKE", lat: 10.7915, status: "ONLINE" },
  { name: "Nearby 2.9 km Sedan", email: "nearby-29km-sedan@cab.local", phone: "+84909003002", plate: "TEST-3002", vehicleType: "SEDAN", lat: 10.7995, status: "ONLINE" },
  { name: "Outside 3.1 km Bike", email: "outside-31km-bike@cab.local", phone: "+84909003003", plate: "TEST-3003", vehicleType: "BIKE", lat: 10.8015, status: "ONLINE" },
  { name: "Offline 1.5 km Bike", email: "offline-15km-bike@cab.local", phone: "+84909003004", plate: "TEST-3004", vehicleType: "BIKE", lat: 10.7870, status: "OFFLINE" },
];

async function request(method, path, body, token, extraHeaders = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    const failure = new Error(`${method} ${path}: HTTP ${response.status} ${JSON.stringify(data)}`);
    failure.status = response.status;
    throw failure;
  }
  return data;
}

async function loginAny(candidates) {
  for (const [email, candidatePassword] of candidates) {
    try {
      return (await request("POST", "/auth/login", { email, password: candidatePassword })).accessToken;
    } catch (error) {
      if (error.status !== 401 || email === candidates.at(-1)[0]) throw error;
    }
  }
}

const adminToken = await loginAny([
  ["adm01@gmail.com", "12345678"],
  ["admin@cab.local", "Admin123!"],
]);

async function allDrivers() {
  const items = [];
  for (let page = 1; ; page += 1) {
    const result = await request("GET", `/admin/drivers?page=${page}&limit=100`, undefined, adminToken);
    items.push(...result.items);
    if (items.length >= result.total) return items;
  }
}

const existing = await allDrivers();
const ids = new Map();
for (const fixture of fixtures) {
  let driver = existing.find((item) => item.plate === fixture.plate && item.fullName === fixture.name);
  let driverId = driver?.id;
  if (!driverId) {
    const challenge = await request("POST", "/drivers/otp/request", { phone: fixture.phone });
    if (!challenge.otpCode) throw new Error("SANDBOX_MODE=true is required to create test drivers");
    const verified = await request("POST", "/drivers/otp/verify", {
      phone: fixture.phone, challengeId: challenge.challengeId, code: challenge.otpCode,
    });
    const registered = await request("POST", "/drivers/register", {
      fullName: fixture.name,
      email: fixture.email,
      password,
      vehicleType: fixture.vehicleType,
      plate: fixture.plate,
    }, verified.registrationToken, { "Idempotency-Key": `nearby-seed-${fixture.plate}` });
    driverId = registered.driverId;
    driver = { applicationStatus: "PENDING_APPROVAL" };
  }
  if (driver.applicationStatus !== "APPROVED") {
    await request("POST", `/admin/drivers/${driverId}/approve`, {}, adminToken);
  }
  const driverToken = (await request("POST", "/auth/login", {
    email: fixture.email, password,
  })).accessToken;
  await request("PUT", "/drivers/me/location", { lat: fixture.lat, lng: center.lng }, driverToken);
  await request("PUT", "/drivers/me/availability", { status: fixture.status }, driverToken);
  ids.set(fixture.plate, driverId);
  console.log(`${fixture.name}: ${driverId} (${fixture.status})`);
}

const customerToken = await loginAny([
  ["kh01@gmail.com", "12345678"],
  ["customer@cab.local", "Customer123!"],
]);
const nearby = await request("GET", `/drivers/nearby?lat=${center.lat}&lng=${center.lng}&limit=100`, undefined, customerToken);
const found = new Set(nearby.items.map((item) => item.id));
for (const fixture of fixtures) {
  const shouldAppear = fixture.status === "ONLINE" && fixture.plate !== "TEST-3003";
  if (found.has(ids.get(fixture.plate)) !== shouldAppear) {
    throw new Error(`Unexpected nearby result for ${fixture.name}`);
  }
}
console.log(`Verified default nearby radius around ${center.lat}, ${center.lng}.`);
