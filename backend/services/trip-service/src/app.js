import { createService } from "../../../shared/service-runtime.js";
import { serviceEndpoints } from "./api/http/endpoints.routes.js";
export function createApp() {
  return createService({ endpoints: serviceEndpoints });
}
