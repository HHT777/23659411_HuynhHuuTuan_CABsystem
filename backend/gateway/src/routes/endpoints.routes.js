import { serviceEndpoints as identityEndpoints } from "../../../services/identity-service/src/api/http/endpoints.routes.js";
import { serviceEndpoints as customerEndpoints } from "../../../services/customer-service/src/api/http/endpoints.routes.js";
import { serviceEndpoints as driverEndpoints } from "../../../services/driver-service/src/api/http/endpoints.routes.js";
import { serviceEndpoints as bookingEndpoints } from "../../../services/booking-service/src/api/http/endpoints.routes.js";
import { serviceEndpoints as tripEndpoints } from "../../../services/trip-service/src/api/http/endpoints.routes.js";
import { serviceEndpoints as paymentEndpoints } from "../../../services/payment-service/src/api/http/endpoints.routes.js";
import { serviceEndpoints as notificationEndpoints } from "../../../services/notification-service/src/api/http/endpoints.routes.js";

export const endpointCatalog = {
  "identity-service": identityEndpoints,
  "customer-service": customerEndpoints,
  "driver-service": driverEndpoints,
  "booking-service": bookingEndpoints,
  "trip-service": tripEndpoints,
  "payment-service": paymentEndpoints,
  "notification-service": notificationEndpoints,
};

export function publicEndpointCatalog() {
  return Object.fromEntries(
    Object.entries(endpointCatalog).map(([service, endpoints]) => [
      service,
      endpoints
        .filter((endpoint) => endpoint.access === "public")
        .map((endpoint) => ({
          ...endpoint,
          url: `http://localhost:8000${endpoint.path}`,
          requiredHeaders: [
            ...(endpoint.roles?.some(
              (role) => !["PUBLIC", "PAYMENT_PROVIDER(HMAC)"].includes(role),
            )
              ? ["Authorization: Bearer <accessToken>"]
              : []),
            ...(endpoint.idempotent ? ["Idempotency-Key"] : []),
            ...(endpoint.roles?.includes("PAYMENT_PROVIDER(HMAC)")
              ? ["X-Timestamp", "X-Signature"]
              : []),
          ],
        })),
    ]),
  );
}
