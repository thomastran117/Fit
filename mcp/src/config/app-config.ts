export interface PackageMetadata {
  name: string;
  version: string;
}

export interface RentifyMcpAuthConfig {
  personalAccessToken?: string;
}

export interface RentifyMcpConfig {
  apiBaseUrl: string;
  apiTimeoutMs: number;
  serverName: string;
  serverVersion: string;
  auth: RentifyMcpAuthConfig;
}

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8040";
const DEFAULT_API_TIMEOUT_MS = 5_000;
const FALLBACK_SERVER_NAME = "rentify-mcp";
const FALLBACK_SERVER_VERSION = "0.0.0";
const API_ROUTE_PREFIX = "/api/v1";

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeApiBaseUrl(value: string): string {
  const normalizedValue = normalizeBaseUrl(value);

  try {
    const url = new URL(normalizedValue);

    if (url.pathname === "/" || url.pathname === "/api") {
      url.pathname = API_ROUTE_PREFIX;
    }

    return normalizeBaseUrl(url.toString());
  } catch {
    return normalizedValue;
  }
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

function readOptionalConfiguredString(
  env: NodeJS.ProcessEnv,
  name: string,
): string | undefined {
  const rawValue = env[name];

  if (rawValue === undefined) {
    return undefined;
  }

  const trimmedValue = rawValue.trim();

  if (!trimmedValue) {
    return undefined;
  }

  return trimmedValue;
}

function readAuthConfig(env: NodeJS.ProcessEnv): RentifyMcpAuthConfig {
  const configuredPat = env.RENTIFY_PAT;

  if (configuredPat !== undefined && !configuredPat.trim()) {
    throw new Error("RENTIFY_PAT must not be empty when configured.");
  }

  const personalAccessToken = readOptionalConfiguredString(env, "RENTIFY_PAT");

  return {
    personalAccessToken,
  };
}

export function createConfig(
  packageMetadata: Partial<PackageMetadata>,
  env: NodeJS.ProcessEnv = process.env,
): RentifyMcpConfig {
  const configuredBaseUrl = env.RENTIFY_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;

  return {
    apiBaseUrl: normalizeApiBaseUrl(configuredBaseUrl),
    apiTimeoutMs: parsePositiveInteger(
      env.RENTIFY_API_TIMEOUT_MS,
      DEFAULT_API_TIMEOUT_MS,
      "RENTIFY_API_TIMEOUT_MS",
    ),
    serverName:
      env.RENTIFY_MCP_NAME?.trim() ||
      packageMetadata.name?.trim() ||
      FALLBACK_SERVER_NAME,
    serverVersion:
      env.RENTIFY_MCP_VERSION?.trim() ||
      packageMetadata.version?.trim() ||
      FALLBACK_SERVER_VERSION,
    auth: readAuthConfig(env),
  };
}
