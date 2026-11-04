import { createService } from "../../../shared/service-runtime.js";
import { serviceEndpoints } from "./api/http/endpoints.routes.js";
import { registerRoutes } from "./api/http/service.routes.js";
export function createApp() {
  return createService({ endpoints: serviceEndpoints, registerRoutes });
}
