export const serviceConfig = () => ({
  name: process.env.SERVICE_NAME ?? "driver-service",
  port: Number(process.env.SERVICE_PORT ?? 3002),
});
