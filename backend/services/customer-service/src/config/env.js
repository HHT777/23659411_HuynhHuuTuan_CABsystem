export const serviceConfig = () => ({
  name: process.env.SERVICE_NAME ?? "customer-service",
  port: Number(process.env.SERVICE_PORT ?? 3001),
});
