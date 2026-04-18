# Rentify

Rentify is a rental marketplace platform where users can list rentable assets such as homes, rooms, equipment, tools, and other items, while other users can discover listings, message owners, request bookings, and complete payments through the platform.

The project is being built as a web-first application with a Node-based backend and room to expand into mobile clients, richer search, and AI/integration tooling over time.

## Vision

Rentify is intended to support the full rental workflow:

- owners create and manage listings
- renters search and compare available listings
- both sides communicate through in-platform messaging
- renters submit booking requests
- owners approve arrangements
- payments and follow-up notifications are handled through the platform

## Tech Stack

The project is planned to stay primarily within the Node ecosystem:

- Backend: `Node.js`, `Hono`, `Prisma`
- Database: `MySQL`
- Cache: `Redis`
- Web client: `Next.js`, `React`
- End-to-end testing: `Playwright`
- File storage: `Azure Blob Storage`
- Search: `Elasticsearch`
- Future mobile client: `React Native`
- Future automation / AI tooling: Node-based `MCP`

## Architecture Direction

The current direction is a modular monolith backend with clear feature boundaries. That keeps delivery fast early on while leaving room to split out heavier concerns later.

Planned infrastructure includes:

- `Azure Blob Storage` for media uploads
- `Elasticsearch` for marketplace search
- a future message broker for decoupled async work such as email sending, notification fanout, indexing, reminders, and payout-related workflows

## Repository Structure

Current and planned structure:

```text
/backend
/docs
/web                 # planned
/mobile              # optional later
/mcp                 # optional later
```

## Current Status

The repository already contains an early backend foundation, including:

- server bootstrap with `Hono`
- environment loading
- database and Redis resource setup
- authentication foundations
- profile-related backend modules
- blob upload support
- email service support

The main product planning document lives here:

- [docs/rentify-plan.md](C:/Users/thoma/Documents/Rent/docs/rentify-plan.md)

## Near-Term Priorities

- finalize MVP scope and booking rules
- expand the Prisma schema for marketplace entities
- add backend modules for listings, bookings, messaging, and payments
- scaffold the `web` application
- define API contracts for the primary owner and renter flows

## Development Notes

At the moment, the backend workspace is under `backend/`.

Useful backend scripts:

- `npm run dev`
- `npm run build`
- `npm run check`
- `npm run prisma:generate`
- `npm run prisma:migrate:dev`

Run them from:

```bash
cd backend
```

## Docker

The repository now includes Docker support for:

- `MySQL`
- `Redis`
- `Elasticsearch`
- the `backend` service
- the `frontend` service

From the repo root, start everything with:

```bash
docker compose up --build
```

Exposed ports:

- frontend: `http://localhost:3040`
- backend: `http://localhost:8040`
- MySQL: `localhost:3306`
- Redis: `localhost:6379`
- Elasticsearch: `http://localhost:9200`

Notes:

- The backend container runs `prisma migrate deploy` before starting the server.
- The current `docker-compose.yml` includes placeholder values for `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `ACCESS_TOKEN_SECRET`, and `REFRESH_TOKEN_SECRET`.
- Replace those placeholders before using the stack for anything beyond local bootstrapping.

## Documentation

- Application plan: [docs/rentify-plan.md](C:/Users/thoma/Documents/Rent/docs/rentify-plan.md)

As the project evolves, it would be useful to add:

- `docs/api-design.md`
- `docs/domain-model.md`
- setup instructions for local development
- deployment notes
