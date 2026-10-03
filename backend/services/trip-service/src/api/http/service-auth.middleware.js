export function serviceAuth(request, response, next) {
  if (!request.get("X-Service-Token"))
    return response.status(401).json({ error: "unauthorized" });
  next();
}
