import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { RentifyApiClient } from "./backend-api-client.js";
import { createConfig } from "./config.js";
import { loadPackageMetadata } from "./package-metadata.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const packageMetadata = await loadPackageMetadata();
  const config = createConfig(packageMetadata);
  const apiClient = new RentifyApiClient({
    baseUrl: config.apiBaseUrl,
    timeoutMs: config.apiTimeoutMs,
  });
  const server = createServer(config, apiClient);
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

void main().catch((error: unknown) => {
  console.error("Failed to start Rentify MCP server.", error);
  process.exit(1);
});
