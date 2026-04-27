# Rentify MCP Server

This package exposes a local `stdio` MCP server for Rentify's postings APIs.

## What It Does

It wraps the live backend HTTP API and exposes public marketplace tools plus authenticated postings-management tools.

Public marketplace tools:

- `search_postings`
- `get_posting`
- `batch_get_postings`
- `list_posting_reviews`

Authenticated postings tools:

- `get_my_posting`
- `list_my_postings`
- `batch_get_my_postings`
- `create_posting`
- `update_posting`
- `duplicate_posting`
- `publish_posting`
- `pause_posting`
- `unpause_posting`
- `archive_posting`
- `list_posting_availability_blocks`
- `create_posting_availability_block`
- `update_posting_availability_block`
- `delete_posting_availability_block`
- `get_postings_analytics_summary`
- `list_postings_analytics`
- `get_posting_analytics`
- `create_posting_review`
- `update_my_posting_review`

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

Public marketplace tools remain unauthenticated. Protected postings tools send `Authorization: Bearer <RENTIFY_PAT>`.

Use a PAT with:

- `mcp:read` for owner posting reads and analytics
- `mcp:write` for posting mutations, availability-block writes, and posting review writes

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
