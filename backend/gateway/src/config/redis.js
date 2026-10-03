export function redisConfig() {
  return { url: process.env.REDIS_URL ?? "redis://redis:6379" };
}
