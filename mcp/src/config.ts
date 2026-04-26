export interface PackageMetadata {
  name: string;
  version: string;
}

export interface RentifyMcpConfig {
  apiBaseUrl: string;
  apiTimeoutMs: number;
  serverName: string;
  serverVersion: string;
}

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8040";
const DEFAULT_API_TIMEOUT_MS = 5_000;
const FALLBACK_SERVER_NAME = "rentify-mcp";
const FALLBACK_SERVER_VERSION = "0.0.0";

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
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

export function createConfig(
  packageMetadata: Partial<PackageMetadata>,
  env: NodeJS.ProcessEnv = process.env,
): RentifyMcpConfig {
  const configuredBaseUrl = env.RENTIFY_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;

  return {
    apiBaseUrl: normalizeBaseUrl(configuredBaseUrl),
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
  };
}
