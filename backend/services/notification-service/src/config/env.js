export const serviceConfig = () => ({
  name: process.env.SERVICE_NAME ?? "notification-service",
  port: Number(process.env.SERVICE_PORT ?? 3006),
});
