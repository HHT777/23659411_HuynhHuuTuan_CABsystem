export function blockInternal(_request, response) {
  return response.status(404).json({ error: "route not found" });
}
