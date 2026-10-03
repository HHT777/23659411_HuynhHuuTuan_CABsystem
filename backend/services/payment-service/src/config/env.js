export const serviceConfig = () => ({
  name: process.env.SERVICE_NAME ?? "payment-service",
  port: Number(process.env.SERVICE_PORT ?? 3005),
});
