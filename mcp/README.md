# Rentify MCP Server

This package exposes a local `stdio` MCP server for Rentify's marketplace APIs.

## What It Does

The current tool surface is intentionally read-only. It wraps the live backend HTTP API and exposes these tools:

- `search_postings`
- `get_posting`
- `batch_get_postings`
- `list_posting_reviews`

The backend API must already be running before this MCP server starts.

Protected MCP integrations can use a Rentify personal access token through `RENTIFY_PAT`. No `auth_*` MCP tools are exposed by this package.

## Configuration

Environment variables:

- `RENTIFY_API_BASE_URL`
  - Default: `http://127.0.0.1:8040`
- `RENTIFY_API_TIMEOUT_MS`
  - Default: `5000`
- `RENTIFY_PAT`
  - Optional personal access token for protected MCP requests
- `RENTIFY_MCP_NAME`
  - Optional override for the MCP server name
- `RENTIFY_MCP_VERSION`
  - Optional override for the MCP server version

Public marketplace tools remain unauthenticated. Protected MCP calls, when added, should send `Authorization: Bearer <RENTIFY_PAT>`.

## Local Development

From this directory:

```bash
npm install
npm run dev
```

Build and run:

```bash
npm run build
npm run start
```

## Example MCP Client Config

Example desktop-style MCP config on Windows:

```json
{
  "mcpServers": {
    "rentify": {
      "command": "node",
      "args": [
        "C:\\Users\\thoma\\Documents\\Rent\\mcp\\dist\\index.js"
      ],
      "env": {
        "RENTIFY_API_BASE_URL": "http://127.0.0.1:8040",
        "RENTIFY_API_TIMEOUT_MS": "5000",
        "RENTIFY_PAT": "rpat_your_public_id_your_secret"
      }
    }
  }
}
```

For development you can also point a client at:

```json
{
  "mcpServers": {
    "rentify-dev": {
      "command": "node",
      "args": [
        "--import",
        "tsx",
        "C:\\Users\\thoma\\Documents\\Rent\\mcp\\src\\index.ts"
      ],
      "env": {
        "RENTIFY_API_BASE_URL": "http://127.0.0.1:8040"
      }
    }
  }
}
```
