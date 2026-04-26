import { createServer as createHttpServer, type Server as HttpServer } from "node:http";
import { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { RentifyApiClient } from "../backend-api-client.js";
import { createConfig } from "../config.js";
import { createServer } from "../server.js";

function startBackendStub(): Promise<{ server: HttpServer; baseUrl: string }> {
  const server = createHttpServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    response.setHeader("content-type", "application/json; charset=UTF-8");

    if (request.method === "GET" && url.pathname === "/postings") {
      response.writeHead(200);
      response.end(
        JSON.stringify({
          postings: [{ id: "post_1", name: "Bike" }],
          pagination: {
            page: 1,
            pageSize: 20,
            total: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
          source: "database",
        }),
      );
      return;
    }

    response.writeHead(404);
    response.end(
      JSON.stringify({
        error: "Not found.",
        code: "RESOURCE_NOT_FOUND",
      }),
    );
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

describe("Rentify MCP server smoke test", () => {
  jest.setTimeout(20_000);

  it("serves the expected marketplace tools and can complete a tool call", async () => {
    const backend = await startBackendStub();
    const client = new Client({
      name: "rentify-mcp-smoke-test",
      version: "1.0.0",
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createServer(
      createConfig({
        name: "rentify-mcp",
        version: "1.0.0",
      }),
      new RentifyApiClient({
        baseUrl: backend.baseUrl,
        timeoutMs: 5_000,
      }),
    );

    await server.connect(serverTransport);

    try {
      await client.connect(clientTransport);

      const toolList = await client.listTools();
      expect(toolList.tools.map((tool) => tool.name).sort()).toEqual([
        "batch_get_postings",
        "get_posting",
        "list_posting_reviews",
        "search_postings",
      ]);

      const result = await client.callTool({
        name: "search_postings",
        arguments: {
          q: "bike",
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({
        postings: [{ id: "post_1" }],
      });
    } finally {
      await client.close();
      await server.close();
      await new Promise<void>((resolve, reject) => {
        backend.server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  });
});
