const url = process.env.GATEWAY_URL ?? "http://localhost:8000";
const counts = new Map();
let first429 = null;
for (let index = 1; index <= 105; index += 1) {
  const response = await fetch(`${url}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "customer@cab.local",
      password: "Customer123!",
    }),
  });
  counts.set(response.status, (counts.get(response.status) ?? 0) + 1);
  if (response.status === 429 && !first429) {
    first429 = {
      request: index,
      retryAfter: response.headers.get("retry-after"),
      rateLimitLimit: response.headers.get("x-ratelimit-limit"),
      rateLimitRemaining: response.headers.get("x-ratelimit-remaining"),
      body: await response.json(),
    };
  } else {
    await response.arrayBuffer();
  }
}
console.log(`BURST|requests=105|statuses=${JSON.stringify(Object.fromEntries(counts))}|first429=${JSON.stringify(first429)}`);
await new Promise((resolve) => setTimeout(resolve, 61_000));
const recovered = await fetch(`${url}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "customer@cab.local",
    password: "Customer123!",
  }),
});
console.log(`RECOVERY|afterSeconds=61|status=${recovered.status}`);
process.exitCode = first429 && recovered.status === 200 ? 0 : 1;
