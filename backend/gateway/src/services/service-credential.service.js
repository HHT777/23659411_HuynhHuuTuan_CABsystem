export function serviceCredential(
  token = process.env.INTERNAL_SERVICE_TOKEN ?? "local-internal-token",
) {
  return { "x-service-token": token };
}
