export function metadataFromRequest(request) {
  return {
    authorization: request.get("Authorization"),
    requestId: request.get("X-Request-ID"),
  };
}
