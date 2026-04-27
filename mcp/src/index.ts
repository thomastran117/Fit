import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createConfig } from "./config/index.js";
import { loadPackageMetadata } from "./config/package-metadata.js";
import { RentifyApiClient } from "./integrations/rentify-api/index.js";
import { createServer } from "./server/index.js";

async function main(): Promise<void> {
  const packageMetadata = await loadPackageMetadata();
  const config = createConfig(packageMetadata);
  const apiClient = new RentifyApiClient({
    baseUrl: config.apiBaseUrl,
    timeoutMs: config.apiTimeoutMs,
    personalAccessToken: config.auth.personalAccessToken,
  });
  const server = createServer(config, apiClient);
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

void main().catch((error: unknown) => {
  console.error("Failed to start Rentify MCP server.", error);
  process.exit(1);
});
