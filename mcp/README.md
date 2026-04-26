# Rentify MCP Server

This package exposes a local `stdio` MCP server for Rentify's public marketplace read APIs.

## What It Does

The first version is intentionally read-only. It wraps the live backend HTTP API and exposes these tools:

- `search_postings`
- `get_posting`
- `batch_get_postings`
- `list_posting_reviews`

The backend API must already be running before this MCP server starts.

## Configuration

Environment variables:

- `RENTIFY_API_BASE_URL`
  - Default: `http://127.0.0.1:8040`
- `RENTIFY_API_TIMEOUT_MS`
  - Default: `5000`
- `RENTIFY_MCP_NAME`
  - Optional override for the MCP server name
- `RENTIFY_MCP_VERSION`
  - Optional override for the MCP server version

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
        "RENTIFY_API_TIMEOUT_MS": "5000"
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
