const API_PATH_SEGMENT = "/api";
const API_VERSION = "v1";

export const API_ROUTE_PREFIX = `${API_PATH_SEGMENT}/${API_VERSION}` as const;

export function getApiVersion(): string {
  return API_VERSION;
}

export function getApiRoutePrefix(): string {
  return API_ROUTE_PREFIX;
}

export function buildApiPath(path = "/"): string {
  if (!path || path === "/") {
    return API_ROUTE_PREFIX;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_ROUTE_PREFIX}${normalizedPath}`;
}

export function stripApiRoutePrefix(pathname: string): string {
  if (pathname === API_ROUTE_PREFIX) {
    return "/";
  }

  if (pathname.startsWith(`${API_ROUTE_PREFIX}/`)) {
    return pathname.slice(API_ROUTE_PREFIX.length);
  }

  return pathname;
}
