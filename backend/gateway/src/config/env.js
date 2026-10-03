export function gatewayConfig() {
  return {
    port: Number(process.env.GATEWAY_PORT ?? 8000),
    token: process.env.INTERNAL_SERVICE_TOKEN ?? "local-internal-token",
  };
}
