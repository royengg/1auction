# 1auction

A real-time auction platform where an auctioneer creates a room, lists items, and bidders join with a room code to bid live. Bids sync instantly across all sessions, a server-authoritative timer resolves each item, and the room ends with a results page.

## Live Demo

https://1auction.cooldash.xyz

## Demo Credentials

email - gamermobile229@gmail.com
pass - Ping_pong29

## Skills referenced (from `.agents/skills/`)

- `frontend-design`
- `improve-codebase-architecture`
- `docker-expert`
- `design.md`

## Tech Stack

| Layer      | Technology                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------- |
| Monorepo   | Bun workspaces — `apps/web`, `apps/socket-server`, `packages/shared`                        |
| Web        | Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · shadcn/ui · TanStack Query |
| Fonts      | Hanken Grotesk (display), Inter (body), JetBrains Mono (labels)                             |
| Auth       | BetterAuth (email/password) + short-lived JWT for WebSocket                                 |
| Realtime   | Express + Socket.IO + ioredis                                                               |
| Database   | PostgreSQL 17 (Neon) + Prisma                                                               |
| Deployment | Coolify via `docker-compose.yml` (web + socket + redis; Postgres external)                  |

## Features

- **Authentication** — Email/password sign up/in, role selection (Auctioneer / Bidder), role switching from dashboard
- **Dashboard** — Role-aware: bidders see public auctions + join-by-code; auctioneers see "Create" CTA + past auctions
- **Create Auction** — Two-section wizard: Event Details (title, budget, increment, duration, max bidders) + Inventory List (dynamic items)
- **Lobby** — Room code display, participant list with online indicators, auctioneer-only "Start" button (requires ≥2 bidders)
- **Live Auction** — Item display, countdown timer, quick bid buttons, custom bid input, bid history, chat, pause/resume (auctioneer)
- **Results** — Stats cards (items sold, participants, revenue), per-item SOLD/UNSOLD cards with winner info
- **Spectator Mode** — Non-participants can watch live auctions with real-time viewer count
- **Audio Feedback** — Synthesized mechanical countdown ticks (last 5s) + gavel sound on expiry

## Architecture

```
┌─────────────────────────┐      ┌──────────────────────────┐
│  apps/web (Next.js)      │      │  apps/socket-server       │
│  - App Router pages      │      │  - Express + Socket.io    │
│  - API routes (Prisma)   │      │  - JWT auth middleware    │
│  - BetterAuth sessions   │      │  - ioredis → Redis        │
│  - Socket.IO client      │      │  - Atomic Lua bid script  │
└───────────┬─────────────┘      └─────────────┬────────────┘
            │                                  │
            │  POST /api/auth/socket-token     │
            │  (signed JWT for WebSocket)      │
            ▼                                  ▼
        ┌──────────────────────┐         ┌──────────────────┐
        │  PostgreSQL (Neon)  │         │  Redis           │
        │  - durable state    │  ◀────  │ - live state     │
        │  - rooms, items,    │  write  │ - highBid, endsAt│
        │    bids, winners    │  drain  │ - reserved budgets│
        └──────────────────────┘         └──────────────────┘
```

- **Redis = live state** (high bid, endsAt, paused, reserved budgets, presence, spectators). The socket server is the single writer.
- **Postgres = durable state** (rooms, items, bids, winners). Next.js API routes write to Postgres; the socket server persists resolved items asynchronously.

## Realtime Design

### Auth Handshake

1. Browser requests `GET /api/auth/socket-token` → receives short-lived JWT
2. Browser opens WebSocket connection (polling → websocket upgrade)
3. Browser emits `client:authenticate` with JWT
4. Socket server verifies JWT, rejects unauthenticated sockets

### Bid Pipeline (Atomic Lua Script)

An atomic Lua script in Redis validates in one round-trip:

1. Item is ACTIVE and not paused
2. Timer has not expired
3. Bidder is authenticated and not the auctioneer
4. Bidder has sufficient available budget
5. Bid amount ≥ highBid + minIncrement
6. Bidder is not already the highest bidder

If valid: releases previous bidder's reserved amount, reserves new bidder's amount, updates high bid, returns updated state.

### Timer

- Server stores `endsAt` (epoch ms) in Redis
- Clients render local countdown (100ms interval)
- Server resolves item on expiry (not the client)
- Pause: records `pausedAt`, rejects bids, recomputes `endsAt += pausedDuration` on resume
- Auto-advance: 5-second cooldown between items

### Socket Events

**Client → Server:** `authenticate`, `joinRoom`, `leaveRoom`, `placeBid`, `sendChat`, `startAuction`, `pauseAuction`, `resumeAuction`

**Server → Client:** `room:state`, `participant:update`, `participant:left`, `spectators:changed`, `status:changed`, `activeItem:changed`, `item:resolved`, `item:state`, `bid:accepted`, `bid:rejected`, `pause`, `chat:message`, `presence`

## Database Schema

See `apps/web/prisma/schema.prisma`. Core models:

- `User` · `Session` · `Account` · `Verification` (BetterAuth)
- `Room` — status (`LOBBY` / `AUCTION` / `COMPLETED`), code, title, budget, increment, duration, maxBidders, activeItemIndex, coverImageUrl
- `RoomParticipant` — per-room budget snapshot, reserved, spent, available
- `AuctionItem` — slotIndex, name, description, imageUrl, startingPrice, status, winnerId, winningBid
- `Bid` — roomId, itemId, userId, amount
- `Winner` — roomId, itemId, userId, amount, wonAt

## AI Usage

See `ai-transcripts/ai-usage-summary.md` for full details. Highlights:

- **AI helped with:** monorepo scaffolding, shared contract design, architectural decisions (server-authoritative timer, Redis atomic bidding, JWT handshake), Docker/Coolify deployment, production debugging (auth, env, database timeouts), frontend features (wizard, audio, auth redirects), and real-time bug fixes
- **Important manual decisions:** self-hosted Redis, split socket server from Next.js, `window.location.href` over `router.push()` for auth, synthesized Web Audio API sounds, polling+websocket transport for proxy reliability, committing `bun.lock` to git, enforcing minimum 2 bidders, server-side session checks for redirects

## Running Locally

### Prerequisites

- Bun runtime
- Redis (`docker run -d --name redis -p 6379:6379 redis:7-alpine`)
- Neon Postgres database (or local Postgres)

### Setup

```bash
bun install
cp .env.example .env
# Fill DATABASE_URL, BETTER_AUTH_SECRET, JWT_SECRET, REDIS_URL, etc.
cd apps/web && bunx prisma generate && bunx prisma migrate deploy
```

### Development

```bash
# Terminal 1 — Web app
bun run dev:web    # → http://localhost:3000

# Terminal 2 — Socket server
bun run dev:socket # → http://localhost:3001
```

Or run both together: `bun dev`

### Production Build

```bash
bun run build        # Build all packages
bun run start:web    # Next.js production
bun run start:socket # Socket server production
```

## Environment Variables

Required (see `.env.example` for full list):

| Variable                 | Purpose                                  |
| ------------------------ | ---------------------------------------- |
| `DATABASE_URL`           | Neon Postgres connection string          |
| `BETTER_AUTH_SECRET`     | Random long string for auth              |
| `JWT_SECRET`             | Must match between web and socket-server |
| `REDIS_URL`              | `redis://localhost:6379`                 |
| `NEXT_PUBLIC_SOCKET_URL` | Browser-facing WebSocket URL             |
| `WEB_ORIGIN`             | CORS origin for socket server            |

## Known Limitations

- Bidders cannot be removed mid-auction
- No reconnection budget reconciliation during network partition
- Dashboard room list polls via HTTP (no live socket updates)
- All rooms are publicly listed; join still requires a code

## Future Improvements

- [ ] Reconnect reconciliation (release reserved budget if bidder never returns)
- [ ] Dashboard live-updating room list via socket
- [ ] Private rooms (not publicly listed)
- [ ] File upload for item images (currently URL input only)
- [ ] Pagination for room list
- [ ] Bid history export

---

Built with AI assistance. All code is human-reviewed and committed intentionally.
