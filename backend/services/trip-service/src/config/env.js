export const serviceConfig = () => ({
  name: process.env.SERVICE_NAME ?? "trip-service",
  port: Number(process.env.SERVICE_PORT ?? 3004),
});
