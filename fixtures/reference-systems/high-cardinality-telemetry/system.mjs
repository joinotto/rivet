export function requestAttributes(request) {
  return {
    "http.request.method": request.method,
    "user.id": request.userId,
  };
}
