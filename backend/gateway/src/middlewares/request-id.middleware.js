import { randomUUID } from "node:crypto";
export function requestIdMiddleware(request, response, next) {
  response.set("X-Request-ID", request.get("X-Request-ID") ?? randomUUID());
  next();
}
