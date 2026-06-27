# 1auction

A real-time auction platform. An auctioneer creates a room, lists items, and bidders join with a room code and bid live. Bids update in real time across all sessions, a server-authoritative timer resolves each item, and the room ends with a results page.

> **Status:** Phase 4 — Frontend complete. All pages implemented with Stitch design system. Backend fully operational with atomic Lua bid script, server-authoritative timer, and pause/resume.

## Live Demo

(To be filled when deployed.)

## Tech Stack

- **Monorepo:** Bun workspaces — `apps/web`, `apps/socket-server`, `packages/shared`
- **Web:** Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS · shadcn/ui · TanStack Query
- **Fonts:** Google Fonts via CSS — Hanken Grotesk (display), Inter (body), JetBrains Mono (labels)
- **Auth:** BetterAuth (email/password) issuing a short-lived JWT for socket authentication
- **API Layer:** Axios with typed methods, interceptors, and 401 redirect handling
- **Realtime:** Express + Socket.io + ioredis (self-hosted Redis)
- **Database:** PostgreSQL 17 (Neon) + Prisma
- **Deployment:** Coolify via `docker-compose.yml` (web + socket + redis; Postgres external via Neon)

## Pages

| Page | Route | Description |
|------|-------|-------------|
| **Landing** | `/` | Hero page with feature highlights |
| **Sign In** | `/sign-in` | Dark card-centered auth with "High-Stakes Security Guaranteed" tagline |
| **Sign Up** | `/sign-up` | Create account with email/password |
| **Onboarding** | `/onboarding` | Role selection: Auctioneer or Bidder |
| **Dashboard** | `/dashboard` | Role-aware: bidder sees public auctions + join-by-code; auctioneer sees "Create" CTA + admin lock overlay |
| **Create Auction** | `/rooms/new` | Multi-section form: title, description, budget, min increment, item duration, max bidders (2–6), dynamic item list |
| **Join Room** | `/rooms/[id]/join` | Code verification screen before entering lobby |
| **Lobby** | `/rooms/[id]/lobby` | Room code display, participant list, item preview, auctioneer-only "Start" button |
| **Auction Room** | `/rooms/[id]/auction` | Live bidding: item display, timer, quick bid buttons, custom bid input, Activity/Chat tabs, pause/resume (auctioneer) |
| **Results** | `/rooms/[id]/results` | Final results: stats cards, per-item SOLD/UNSOLD cards with winner info |
| **Stubs** | `/active-bids`, `/my-auctions`, `/watchlist`, `/settings` | Navigational stubs |

## Features

### Authentication
- Email/password sign up and sign in
- BetterAuth sessions with cookie-based auth
- Short-lived JWT for WebSocket handshake
- Role selection on first login (Auctioneer / Bidder)
- Role switching from top-right dropdown (disabled during active auction/lobby)

### Dashboard
- **Bidder view:** Publicly listed auctions with category/status badges, stats row (Active Bids, Won Items, Total Exposure), direct room code entry
- **Auctioneer view:** "Create New Auction" CTA, public rooms with admin lock overlay, "My Past Auctions" section
- Responsive auction cards with image placeholder, bid info, and action buttons

### Auction Creation
- Multi-section form following Stitch design system
- Event Details: title, description, per-room budget, minimum increment, item duration, max bidders (2–6)
- Inventory List: dynamic array of items with name, description, image URL, starting price
- Add/remove items individually
- Creates room in LOBBY status, navigates to lobby

### Lobby
- Minimal top bar with "Leave Lobby" button
- Centered layout: "LOBBY OPEN" status badge, large room code display with copy button
- Joined participants list with avatar, online indicator, HOST badge
- Auction items preview
- Auctioneer-only "Start Auction" button (requires minimum bidders)

### Live Auction Room
- **Main area:** Large item image, LIVE badge, countdown timer, item name, current bid, bidder budget
- **Bid controls:** Quick bid buttons (+minIncrement, +2×, +5×), custom bid input with minimum validation
- **Bid validation:** Cannot bid if you're already the highest bidder (server-enforced via Lua script)
- **Auctioneer controls:** Pause/Resume button
- **Right sidebar:** Activity log (bid history with avatars, timestamps, amounts) + Chat tab (ephemeral messages)
- **Timer:** Server-authoritative countdown with pause state handling

### Results
- "AUCTION OFFICIAL FINALIZED" status banner
- Stats row: Total Items Sold, Participants, Total Revenue
- Per-item cards: slot number, item name, SOLD/UNSOLD badge, winner name, hammer price
- "Return to Dashboard" and "View Live Auctions" actions

## Architecture

```
┌─────────────────────────┐      ┌──────────────────────────┐
│  apps/web (Next.js)      │      │  apps/socket-server       │
│  - App Router pages      │      │  - Express + Socket.io    │
│  - API route handlers    │      │  - JWT-auth middleware     │
│  - Prisma → Postgres     │      │  - ioredis → Redis        │
│  - BetterAuth sessions   │      │  - Atomic Lua bid script  │
│  - Axios API client      │      │  - Server-authoritative   │
│  - Socket hooks          │      │    timer + presence       │
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

### State Authority
- **Redis = live state** (high bid, endsAt, paused, reserved budgets, presence sets). The socket server is the single writer.
- **Postgres = durable state** (rooms, items, bids, winners). Next.js API routes write to Postgres; the socket server persists resolved items asynchronously.

### Auth Handshake
1. Browser requests `GET /api/auth/socket-token` → receives short-lived JWT
2. Browser opens WebSocket connection
3. Browser emits `client:authenticate` with JWT
4. Socket server verifies JWT signature, rejects unauthenticated sockets

### Bid Pipeline (Atomic)
An atomic Lua script in Redis validates in one round-trip:
1. Item is ACTIVE and not paused
2. Timer has not expired
3. Bidder is authenticated and not the auctioneer
4. Bidder has sufficient available budget
5. Bid amount ≥ highBid + minIncrement
6. **Bidder is not already the highest bidder**

If valid, the script:
- Releases previous bidder's reserved amount
- Reserves new bidder's amount
- Updates high bid
- Returns updated state

### Timer
- Server stores `endsAt` (epoch ms) in Redis
- Clients render local countdown
- Server resolves item on expiry (not the client)
- Pause: records `pausedAt`, rejects bids, recomputes `endsAt += pausedDuration` on resume
- Auto-advance: 5-second cooldown between items

## Socket Events

### Client → Server
- `client:authenticate` — JWT handshake
- `client:joinRoom` — enter room
- `client:leaveRoom` — exit room
- `client:placeBid` — submit bid
- `client:sendChat` — send message
- `client:startAuction` — auctioneer starts (lobby → auction)
- `client:pauseAuction` — auctioneer pauses
- `client:resumeAuction` — auctioneer resumes

### Server → Client
- `room:state` — full room snapshot
- `room:participant:update` — bidder joined/updated
- `room:participant:left` — bidder disconnected
- `room:status:changed` — LOBBY → AUCTION → COMPLETED
- `room:item:resolved` — item marked SOLD/UNSOLD
- `room:activeItem:changed` — next item started
- `room:item:state` — item patch (highBid update)
- `bid:accepted` — bid succeeded, includes updated bidders
- `bid:rejected` — bid failed with reason
- `auction:pause` — pause state update
- `chat:message` — ephemeral chat
- `presence` — online user list

## Database Schema

See `apps/web/prisma/schema.prisma`. Core models:

- `User` · `Session` · `Account` · `Verification` (BetterAuth)
- `Room` (status: `LOBBY` / `AUCTION` / `COMPLETED`, code, title, perRoomBudget, minIncrement, itemDurationSeconds, maxBidders, activeItemIndex)
- `RoomParticipant` (per-room budget snapshot, reserved, spent, available)
- `AuctionItem` (slotIndex, name, description, imageUrl, startingPrice, status, winnerId, winningBid)
- `Bid` (roomId, itemId, userId, amount)
- `Winner` (roomId, itemId, userId, amount, wonAt)

Migrations are in `apps/web/prisma/migrations/`.

## API Client

Typed Axios wrapper in `apps/web/src/lib/api-client.ts`:

```typescript
apiClient.listRooms()        → { rooms: RoomSummary[], viewerRole: Role }
apiClient.getRoom(id)        → RoomDetail
apiClient.createRoom(input)  → RoomDetail
apiClient.joinRoom(id, code) → RoomDetail
apiClient.startAuction(id)   → void
apiClient.getResults(id)     → ResolvedItem[]
apiClient.getRole()          → { id, activeRole }
apiClient.switchRole(role)   → { id, activeRole }
apiClient.getSocketToken()   → { token }
```

## Environment Variables

See `.env.example` for the full list. Required:

- `DATABASE_URL` — Neon Postgres connection string
- `BETTER_AUTH_SECRET` — random long string
- `JWT_SECRET` — must match between web and socket-server
- `REDIS_URL` — `redis://localhost:6379`
- `NEXT_PUBLIC_SOCKET_URL` — browser-facing WebSocket URL (`ws://localhost:3001` in dev)
- `WEB_ORIGIN` — origin the socket server allows for CORS (`http://localhost:3000` in dev)

## Running Locally

### Prerequisites
- Bun runtime
- Redis (via Docker: `docker run -d --name redis -p 6379:6379 redis:7-alpine`)
- Neon Postgres database (or local Postgres)

### Setup
```bash
# 1. Install dependencies
bun install

# 2. Configure environment
cp .env.example .env
# Fill DATABASE_URL, BETTER_AUTH_SECRET, JWT_SECRET, REDIS_URL, etc.

# 3. Generate Prisma client and apply migrations
cd apps/web
bunx prisma generate
DATABASE_URL="your-neon-url" bunx prisma migrate deploy
```

### Development
Run the web app and socket server in **separate terminals** for clean output:

```bash
# Terminal 1 — Web app (Next.js)
bun run dev:web
# → http://localhost:3000

# Terminal 2 — Socket server
bun run dev:socket
# → http://localhost:3001
```

Or run both together (output mixed):
```bash
bun dev
```

### Production Build
```bash
# Build all packages
bun run build

# Start production servers
bun run start:web     # Next.js production
bun run start:socket  # Socket server production
```

## Testing

No automated tests yet. For manual testing:

1. Sign up as User A (Auctioneer), create a room
2. Copy the room code
3. Sign up as User B (Bidder), join with the code
4. Sign up as User C (Bidder), join with the code
5. Auctioneer clicks "Start Auction"
6. Bidder B and Bidder C place bids
7. Verify highest bidder cannot bid again
8. Verify timer auto-resolves items
9. Check results page shows correct winners

## Known Limitations

- No automated tests yet
- No seed data
- Bidders cannot be removed mid-auction
- No reconnection budget reconciliation during network partition
- Dashboard room list polls via HTTP (no live socket updates)
- All rooms are publicly listed; join still requires a code

## Future Improvements

- [ ] Automated tests for atomic Lua bid pipeline
- [ ] Reconnect reconciliation (release reserved budget if bidder never returns)
- [ ] Dashboard live-updating room list via socket
- [ ] Private rooms (not publicly listed)
- [ ] File upload for item images (currently URL input only)
- [ ] Pagination for room list
- [ ] Bid history export

## AI Usage

See `ai-transcripts/ai-usage-summary.md` for tools used, decisions made with AI, and manual overrides.

---

Built with AI assistance. All code is human-reviewed and committed intentionally.
