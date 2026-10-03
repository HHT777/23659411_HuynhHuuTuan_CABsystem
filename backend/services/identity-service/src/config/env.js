export const serviceConfig = () => ({
  name: process.env.SERVICE_NAME ?? "identity-service",
  port: Number(process.env.SERVICE_PORT ?? 3000),
});
