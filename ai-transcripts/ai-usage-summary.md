# AI Usage Summary

## Tools used

- OpenCode (primary — live coding session)
- Bun (monorepo management, package installation, builds)
- Docker + docker-compose (local prod simulation, Coolify deployment)
- Git (version control, diff analysis, commit history tracing)
- Prisma (database schema, migrations, client generation)
- Socket.IO (real-time auction engine — server + client)
- Redis (ioredis — live state, presence, spectators, bidding)
- Web Audio API (client-side synthesized auction sounds)
- Next.js 15 App Router (server components, middleware, client pages)

## Skills referenced (from `.agents/skills/`)

- `frontend-design`
- `improve-codebase-architecture`
- `docker-expert`
- `design.md`

## What AI helped with

### Production deployment debugging & fixes

- **Root-caused `DATABASE_URL` not found** in Prisma scripts inside Docker; added `bun --env-file ../../.env` to package.json scripts
- **Fixed Docker build failures** (updated `oven/bun:1.3` → `1.2`, added `bun.lock` to Dockerfiles, committed `bun.lock` to git)
- **Fixed Prisma binary target mismatch** for ARM64 Mac → AMD64 VPS builds by adding `linux-musl-arm64-openssl-3.0.x`
- **Fixed `BETTER_AUTH_URL` missing `https://`** protocol causing auth failures in production
- **Fixed BetterAuth dynamic `baseURL`** config for reverse proxy (`allowedHosts` + `protocol: "auto"`)
- **Fixed `__Secure-` cookie prefix** in middleware to handle both HTTPS production and HTTP local dev
- **Fixed Next.js auth redirect race condition** by replacing `router.push()` with `window.location.href`
- **Temporarily removed health checks** from docker-compose/Dockerfiles to resolve Coolify 404 proxy issues
- **Fixed `P2028` Prisma transaction timeout** on cold starts: added `P2028` to retry patterns, wrapped `createRoom` in `withDbRetry`, appended `pool_timeout=30` to `DATABASE_URL`

### Frontend features

- **Two-section create auction wizard** (Event Details + Catalogue Items) with step indicator
- **Results page layout improvements**: 50-50 side-by-side action buttons, Total Revenue moved to stats row as 4th column
- **Installed `agentation` / `agentation-team`** for visual frontend feedback in dev
- **Auction countdown audio** using Web Audio API: mechanical ticks (last 5s) + gavel sound on expiry
- **Auto-redirect for logged-in users**: server-side session checks on `/`, `/sign-in`, `/sign-up` redirecting to `/dashboard`

### Real-time auction bug fixes

- **Fixed spectator empty room bug**: moved bidder re-sync from spectator-only branch to unconditional execution before snapshot build
- **Fixed "can bid again after expiry" flicker**: added `!activeItem` to bid button `disabled` condition + reset `remainingMs` to `0` when `endsAt` becomes `null`
- **Fixed audio ticks playing too fast / missing 0s tick**: memoized `useAuctionAudio` return object with `useMemo` to prevent `reset()` firing every render; adjusted boundary conditions to include `seconds >= 0`

### Database & schema

- Added `coverImageUrl` migration to sync schema history
- Enforced `MIN_BIDDERS_TO_START: 2` (changed from 1) with backend validation in `handleStartAuction`

## Important manual decisions taken by the user

- **Chose to temporarily remove health checks** for Coolify proxy compatibility (to be re-added with Node.js-based checks later)
- **Chose `window.location.href` over `router.push()`** for post-auth navigation to avoid Next.js App Router race conditions
- **Chose Web Audio API for auction sounds** — no external audio assets needed, fully synthesized
- **Chose `polling` + `websocket` transport** for Socket.IO instead of `["websocket"]` — more reliable behind Traefik/Coolify reverse proxy
- **Chose to commit `bun.lock` to git** for reproducible Docker builds (was in `.gitignore`)
- **Chose `bun --env-file ../../.env` pattern** for Prisma scripts and dev script to ensure env vars are always loaded
- **Chose to enforce minimum 2 bidders** (`MIN_BIDDERS_TO_START: 2`) before auction can start
- **Chose to split create auction form into two-section wizard** (Event Details + Catalogue Items)
- **Chose server-side session checks** using `auth.api.getSession()` with Next.js `headers()` for instant auth redirects
- **Chose to convert auth pages (`/`, `/sign-in`, `/sign-up`) to async server components** with session redirect logic
- **Chose to fix bugs before deploying** after confirming they reproduce locally and affect user experience
