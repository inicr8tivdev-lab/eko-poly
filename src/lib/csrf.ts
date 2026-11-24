export function isAllowedOrigin(origin: string, request: Request): boolean {
  const reqOrigin = new URL(request.url).origin;
  if (origin === reqOrigin) return true;
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (!forwardedHost) return false;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  return origin === `${forwardedProto}://${forwardedHost}`;
}

export function isAllowedSecFetchSite(fetchSite: string, request: Request): boolean {
  if (fetchSite === "same-origin") return true;
  const origin = request.headers.get("Origin");
  if (origin) return isAllowedOrigin(origin, request);
  const referer = request.headers.get("Referer");
  if (!referer) return false;
  try {
    return isAllowedOrigin(new URL(referer).origin, request);
  } catch {
    return false;
  }
}
