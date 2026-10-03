export const serviceConfig = () => ({
  name: process.env.SERVICE_NAME ?? "booking-service",
  port: Number(process.env.SERVICE_PORT ?? 3003),
});
