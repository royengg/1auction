# 1auction

A real-time auction platform. An auctioneer creates a room, lists items, and bidders join with a room code and bid live. Bids update in real time across all sessions, a server-authoritative timer resolves each item, and the room ends with a results page.

> **Status:** Phase 1 — foundation scaffold complete. Realtime handlers are stubbed and will be filled in subsequent phases.

## Live Demo

(To be filled when deployed.)

## Demo credentials

Sign up with any email/password — no pre-seeded demo account in Phase 1.

## Tech stack

- **Monorepo:** Bun workspaces — `apps/web`, `apps/socket-server`, `packages/shared`
- **Web:** Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind · shadcn/ui · Zustand · TanStack Query
- **Auth:** BetterAuth (email/password) issuing a short-lived JWT for socket authentication
- **Realtime:** Express + Socket.io + ioredis (self-hosted Redis)
- **Database:** PostgreSQL 17 (Neon) + Prisma
- **Deployment:** Coolify via `docker-compose.yml` (web + socket + redis; Postgres external via Neon)

## Features

- Sign up / sign in (email + password)
- Forced role selection after login: Auctioneer or Bidder
- Role switchable from the dashboard only (top-left dropdown), blocked inside lobby/auction
- Auctioneer dashboard: "Create Auction" enabled, public rooms locked
- Bidder dashboard: "Create Auction" locked (popup nudge), public rooms joinable by code
- Auction setup form: items (name, description, image URL, starting price), per-room budget, min increment, item timer duration
- Lobby state: room code, participant list, item preview; auctioneer-only "Start"
- Auction room: item centered, bidders "seated" abstractly, live bids, countdown, chat sidebar
- Server-authoritative timer, pause/resume (auctioneer only), no skip
- Per-room bidder wallets; outbid releases reserved budget; SOLD permanently deducts
- Auto-advance to next item after a 5-second cooldown
- Final results page: who won what, for how much

## Architecture

```
┌─────────────────────────┐      ┌──────────────────────────┐
│  apps/web (Next.js)      │      │  apps/socket-server       │
│  - App Router pages      │      │  - Express + Socket.io    │
│  - API route handlers    │      │  - JWT-auth middleware     │
│  - Prisma → Postgres     │      │  - ioredis → Redis        │
│  - BetterAuth sessions   │      │  - Server-authoritative   │
└───────────┬─────────────┘      │    timer + atomic bids    │
            │                    └─────────────┬────────────┘
            │  POST /api/auth/                  │
            │    socket-token (signed JWT)      │
            ▼                                  ▼
        ┌──────────────────────┐         ┌──────────────────┐
        │  PostgreSQL (Neon)  │         │  Redis           │
        │  - durable state    │  ◀────  │ - live state     │
        │  - rooms, items,    │  write  │ - highBid, endsAt │
        │    bids, winners    │  drain  │ - reserved budgets│
        └──────────────────────┘         └──────────────────┘
```

- **Live state** (high bid, endsAt, paused, reserved budgets, presence) lives in Redis. The socket server is the single writer.
- **Durable state** (rooms, items, resolved winners) lives in Postgres. The Next.js API routes write to Postgres; the socket server persists resolved items asynchronously.
- **Auth handshake:** the web app `POST /api/auth/socket-token` returns a short-lived JWT signed with a shared secret. The browser passes it to the socket server via the `client:authenticate` event. The socket server verifies the signature and refuses events from unauthenticated sockets.

## Realtime design

- Timer: the server stores `auctionEndsAt` (epoch ms) in Redis. Clients render a local countdown and the server resolves the item on expiry — never the client.
- Pause: auctioneer emits pause → server records `pausedAt`; bidding is rejected while paused; resume recomputes `auctionEndsAt += pausedDuration`.
- Bid placement: an atomic Lua script in Redis validates (room is AUCTION, not paused, timer active, bidder has available budget, amount ≥ highBid + minIncrement), updates highBid, releases the previous bidder's reserved amount, reserves the new bidder's amount — all in one round-trip.
- SOLD resolution: on timer expiry, if a high bid exists, the winner's reserved amount is converted to permanent `spent` and written to Postgres. If no bid, the item is marked UNSOLD.
- Auto-advance: after a 5-second cooldown the server advances to the next item and emits `room:activeItem:changed`.
- Late joiners: on `client:joinRoom` the server emits a full `room:state` snapshot so the new client immediately syncs.
- Chat: ephemeral — broadcast only, never persisted.

## Database schema

See `apps/web/prisma/schema.prisma`. Core models:

- `User` · `Session` · `Account` · `Verification` (BetterAuth)
- `Room` (status: `LOBBY` / `AUCTION` / `COMPLETED`, perRoomBudget, minIncrement, itemDurationSeconds, activeItemIndex)
- `RoomParticipant` (per-room budget snapshot, reserved, spent)
- `AuctionItem` (slotIndex, startingPrice, status, winnerId, winningBid)
- `Bid` (roomId, itemId, userId, amount)
- `Winner` (roomId, itemId, userId, amount)

## AI usage

See `ai-transcripts/ai-usage-summary.md` for tools used, decisions made with AI, manual overrides, and OpenCode `/share` links.

## Running locally

```bash
# 1. Install dependencies
bun install

# 2. Configure environment
cp .env.example .env
# fill DATABASE_URL, BETTER_AUTH_SECRET, JWT_SECRET, etc.

# 3. Generate Prisma client + apply migrations + seed
bun --filter @auction/web db:generate
bun --filter @auction/web db:migrate

# 4. Start Redis (or use docker-compose)
docker compose up -d redis

# 5. Run both apps (in separate terminals, or together)
bun dev               # both web + socket
#   or
bun dev:web           # → http://localhost:3000
bun dev:socket        # → http://localhost:3001
```

## Environment variables

See `.env.example` for the full list and descriptions. Required:

- `DATABASE_URL` — Neon Postgres connection string
- `BETTER_AUTH_SECRET` — random long string
- `JWT_SECRET` — must match between web and socket-server
- `REDIS_URL` — `redis://localhost:6379` (or `redis://redis:6379` in compose)
- `NEXT_PUBLIC_SOCKET_URL` — browser-facing WebSocket URL
- `WEB_ORIGIN` — origin the socket server allows for CORS

## Known limitations

- Phase 1 scaffold only — realtime handlers are stubbed.
- No tests yet.
- No seed data yet.
- Auctioneer cannot bid on own items, but bidders cannot be "removed" mid-auction.
- No reconnection juggling for reserved budgets during a network partition (planned for Phase 4).

## Future improvements

- Reconnect reconciliation (release reserved budget if a bidder never returns).
- Tests for the atomic Lua bid pipeline.
- Dashboard live-updating room list via socket instead of polling.
- Optional private rooms (currently all rooms are publicly listed; join still requires a code).